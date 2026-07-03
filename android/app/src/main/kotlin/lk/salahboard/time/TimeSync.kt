package lk.salahboard.time

import android.os.Handler
import android.os.HandlerThread
import lk.salahboard.config.ConfigStore

/**
 * Periodic SNTP re-sync (M4). Never blocks boot — if every attempt fails
 * (no internet), the previously persisted `offsetMs` / manual admin-set
 * offset simply stands, per the offline guarantee (SPEC.md).
 */
class TimeSync(private val configStore: ConfigStore) {

    private val thread = HandlerThread("salah-time-sync").apply { start() }
    private val handler = Handler(thread.looper)

    private val syncRunnable = object : Runnable {
        override fun run() {
            syncOnce()
            handler.postDelayed(this, RESYNC_INTERVAL_MS)
        }
    }

    fun start() {
        handler.post(syncRunnable)
    }

    fun stop() {
        handler.removeCallbacks(syncRunnable)
    }

    /** Also called eagerly from the boot sanity check so a box that boots
     * with internet but a wrong clock corrects within seconds, not the
     * full resync interval. */
    fun syncOnce(): Boolean {
        for (host in NTP_HOSTS) {
            val result = SntpClient.query(host)
            if (result != null) {
                val offsetMs = result.ntpTimeMs - System.currentTimeMillis()
                configStore.updateTime(offsetMs, "ntp")
                return true
            }
        }
        return false
    }

    companion object {
        private val NTP_HOSTS = listOf("time.google.com", "pool.ntp.org", "time.cloudflare.com")
        private const val RESYNC_INTERVAL_MS = 6L * 60 * 60 * 1000 // 6 hours
    }
}
