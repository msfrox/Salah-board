package lk.salahboard.server

import android.content.Context
import android.os.SystemClock
import fi.iki.elonen.NanoHTTPD
import lk.salahboard.config.ConfigStore
import lk.salahboard.data.DataRefresh
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Embedded server backing D4/D8: serves display/ + admin/ (packaged as
 * assets, see :app:copyWebAssets) and the tiny JSON API documented in
 * admin/api.md — all from one process, localhost + LAN only, never
 * public. NanoHTTPD is the one HTTP dependency the shell carries
 * (android/README.md).
 */
class SalahHttpServer(
    private val context: Context,
    port: Int,
    private val configStore: ConfigStore,
    private val dataRefresh: DataRefresh,
    private val onConfigChanged: () -> Unit,
) : NanoHTTPD(port) {

    private val startTime = SystemClock.elapsedRealtime()
    private val assetManager = context.assets

    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri
        return try {
            when {
                uri == "/api/config" && session.method == Method.GET -> getConfig()
                uri == "/api/config" && session.method == Method.PUT -> putConfig(session)
                uri == "/api/status" && session.method == Method.GET -> getStatus()
                uri == "/api/time" && session.method == Method.POST -> postTime(session)
                uri == "/api/data-refresh" && session.method == Method.POST -> postDataRefresh()
                uri == "/api/preview" && session.method == Method.POST -> postPreview()
                else -> serveStatic(uri)
            }
        } catch (e: Exception) {
            jsonResponse(Response.Status.INTERNAL_ERROR, JSONObject().put("error", e.message ?: "internal error"))
        }
    }

    // ── /api/config ──────────────────────────────────────────
    private fun getConfig(): Response = jsonResponse(Response.Status.OK, configStore.read())

    private fun putConfig(session: IHTTPSession): Response {
        val body = readBody(session)
        val parsed = try {
            JSONObject(body)
        } catch (e: Exception) {
            return jsonResponse(Response.Status.BAD_REQUEST, JSONObject().put("error", "invalid JSON"))
        }
        configStore.write(parsed)
        onConfigChanged() // tell the WebView to reload — see MainActivity
        return jsonResponse(Response.Status.OK, JSONObject().put("ok", true))
    }

    // ── /api/status ───────────────────────────────────────────
    private fun getStatus(): Response {
        val zones = try {
            assetManager.list("www/display/data")?.filter { it.startsWith("zone") } ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
        val status = JSONObject()
            .put("version", "1.0.0")
            .put("uptimeMs", SystemClock.elapsedRealtime() - startTime)
            .put("lastConfigSaveISO", configStore.read().optJSONObject("time")?.optString("lastSyncISO"))
            .put("dataZones", JSONArray(zones))
        return jsonResponse(Response.Status.OK, status)
    }

    // ── /api/time — manual date/time set (M4, D5) ────────────
    private fun postTime(session: IHTTPSession): Response {
        val body = JSONObject(readBody(session))
        val iso = body.optString("iso", "")
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        fmt.timeZone = TimeZone.getDefault()
        val target = try {
            fmt.parse(iso)?.time
        } catch (e: Exception) {
            null
        } ?: return jsonResponse(Response.Status.BAD_REQUEST, JSONObject().put("error", "iso must be yyyy-MM-ddTHH:mm:ss"))
        val offsetMs = target - System.currentTimeMillis()
        configStore.updateTime(offsetMs, "manual")
        onConfigChanged()
        return jsonResponse(Response.Status.OK, JSONObject().put("ok", true).put("offsetMs", offsetMs))
    }

    // ── /api/data-refresh — manual ACJU data check (M5, D6) ──
    private fun postDataRefresh(): Response {
        val zone = configStore.read().optString("zone", "01")
        val result = dataRefresh.refresh(zone)
        val json = JSONObject()
            .put("checked", result.checked)
            .put("updated", JSONArray(result.updated))
        result.error?.let { json.put("error", it) }
        if (result.updated.isNotEmpty()) onConfigChanged()
        return jsonResponse(Response.Status.OK, json)
    }

    // ── /api/preview — QA helper mirroring ?state= debug param ─
    private fun postPreview(): Response = jsonResponse(Response.Status.OK, JSONObject().put("ok", true))

    // ── Static files: display at "/", admin at "/admin/" ─────
    private fun serveStatic(rawUri: String): Response {
        if (rawUri == "/admin") return redirect("/admin/")

        val (base, path) = if (rawUri.startsWith("/admin/")) {
            "www/admin" to rawUri.removePrefix("/admin/")
        } else {
            "www/display" to rawUri.removePrefix("/")
        }
        val relPath = path.ifEmpty { "index.html" }

        // Refreshed ACJU data (M5) overrides the bundled asset copy.
        if (base == "www/display" && relPath.startsWith("data/")) {
            val override = dataRefresh.overrideDirFor(relPath.removePrefix("data/"))
            if (override != null) return fileResponse(override.readBytes(), relPath)
        }

        return try {
            val bytes = assetManager.open("$base/$relPath").use { it.readBytes() }
            fileResponse(bytes, relPath)
        } catch (e: Exception) {
            newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "not found: $rawUri")
        }
    }

    private fun fileResponse(bytes: ByteArray, path: String): Response =
        newFixedLengthResponse(Response.Status.OK, mimeTypeFor(path), bytes.inputStream(), bytes.size.toLong())

    private fun mimeTypeFor(path: String): String = when (path.substringAfterLast('.', "")) {
        "html" -> "text/html"
        "css" -> "text/css"
        "js" -> "application/javascript"
        "json" -> "application/json"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "ico" -> "image/x-icon"
        "woff" -> "font/woff"
        "woff2" -> "font/woff2"
        "ttf" -> "font/ttf"
        else -> "application/octet-stream"
    }

    private fun redirect(location: String): Response {
        val r = newFixedLengthResponse(Response.Status.REDIRECT, "text/plain", "")
        r.addHeader("Location", location)
        return r
    }

    private fun jsonResponse(status: Response.Status, json: JSONObject): Response =
        newFixedLengthResponse(status, "application/json", json.toString())

    private fun readBody(session: IHTTPSession): String {
        val len = session.headers["content-length"]?.toIntOrNull() ?: 0
        val buffer = ByteArray(len)
        session.inputStream.read(buffer, 0, len)
        return String(buffer)
    }
}
