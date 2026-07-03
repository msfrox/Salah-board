package lk.salahboard.data

import android.content.Context
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Optional data refresh (M5, docs/ARCHITECTURE.md D6). All 13 zones × 12
 * months ship bundled in assets and the app never needs this to run — it
 * is a manual, admin-triggered "check pray.gear.lk for an ACJU revision"
 * action, not a background poller, so a masjid never gets surprise data
 * usage or silent behaviour changes (SPEC.md § Offline guarantee #5).
 *
 * There is no dedicated version/hash endpoint on pray.gear.lk today (see
 * tools/sync-data.ps1 — it only exposes the plain zoneNN-MM.json files),
 * so "compares a version/hash" is done client-side: download the 12
 * month files for the configured zone and SHA-256 them against what's
 * already active (an override from a previous refresh, or the bundled
 * asset copy). Only files that actually differ get written.
 */
class DataRefresh(private val context: Context) {

    private val overrideDir = File(context.filesDir, "data-override").apply { mkdirs() }

    data class RefreshResult(val checked: Int, val updated: List<String>, val error: String?)

    fun overrideDirFor(fileName: String): File? {
        val f = File(overrideDir, fileName)
        return if (f.exists()) f else null
    }

    fun refresh(zone: String): RefreshResult {
        val updated = mutableListOf<String>()
        for (month in 1..12) {
            val fileName = "zone%s-%02d.json".format(zone, month)
            try {
                val remote = download("https://pray.gear.lk/data/$fileName") ?: continue
                val current = overrideDirFor(fileName)?.readBytes() ?: readBundled(fileName)
                if (current == null || !sha256(current).contentEquals(sha256(remote))) {
                    File(overrideDir, fileName).writeBytes(remote)
                    updated.add(fileName)
                }
            } catch (e: Exception) {
                return RefreshResult(month - 1, updated, e.message ?: "download failed for $fileName")
            }
        }
        return RefreshResult(12, updated, null)
    }

    private fun readBundled(fileName: String): ByteArray? = try {
        context.assets.open("www/display/data/$fileName").use { it.readBytes() }
    } catch (e: Exception) {
        null
    }

    private fun download(urlStr: String): ByteArray? {
        val conn = URL(urlStr).openConnection() as HttpURLConnection
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        return try {
            if (conn.responseCode != 200) return null
            conn.inputStream.use { it.readBytes() }
        } finally {
            conn.disconnect()
        }
    }

    private fun sha256(bytes: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(bytes)
}
