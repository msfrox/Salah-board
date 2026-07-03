package lk.salahboard.config

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Single JSON file on disk — the Android side of the "config.json is the
 * single contract" rule (CLAUDE.md #4, docs/ARCHITECTURE.md D7). The shell
 * never interprets the config, it just stores and hands back whatever the
 * admin panel PUTs; `display/js/config.js` deep-merges it onto its own
 * defaults, so a missing/partial file here is fine.
 */
class ConfigStore(context: Context) {

    private val file = File(context.filesDir, "config.json")
    private val lock = Any()

    fun read(): JSONObject = synchronized(lock) {
        if (!file.exists()) return JSONObject()
        return try {
            JSONObject(file.readText())
        } catch (e: Exception) {
            JSONObject()
        }
    }

    /** Overwrites the whole file. Caller (the HTTP API) is responsible for
     * basic shape validation before calling this — the store itself just
     * persists bytes atomically. */
    fun write(config: JSONObject) = synchronized(lock) {
        val tmp = File(file.parentFile, file.name + ".tmp")
        tmp.writeText(config.toString())
        tmp.renameTo(file)
    }

    /** Merges the `time` sub-object (D5 offset tracking) without touching
     * the rest of the config, so an NTP sync never clobbers a caretaker's
     * settings saved from the admin panel moments earlier. */
    fun updateTime(offsetMs: Long, source: String) = synchronized(lock) {
        val config = read()
        val time = config.optJSONObject("time") ?: JSONObject()
        time.put("offsetMs", offsetMs)
        time.put("lastSyncISO", nowIso(offsetMs))
        time.put("lastSyncSource", source)
        if (!time.has("ntpEnabled")) time.put("ntpEnabled", true)
        config.put("time", time)
        write(config)
    }

    fun currentOffsetMs(): Long = read().optJSONObject("time")?.optLong("offsetMs", 0L) ?: 0L

    /** displayTime = system clock + offsetMs (D5) — never trust the raw
     * system clock on boxes without an RTC battery. */
    fun correctedNowMs(): Long = System.currentTimeMillis() + currentOffsetMs()

    private fun nowIso(offsetMs: Long): String {
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        fmt.timeZone = TimeZone.getDefault()
        return fmt.format(Date(System.currentTimeMillis() + offsetMs))
    }
}
