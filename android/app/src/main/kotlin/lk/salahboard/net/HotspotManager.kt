package lk.salahboard.net

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Handler
import android.os.Looper

/**
 * LocalOnlyHotspot wrapper (D4 "no WiFi at the masjid" fallback). Started
 * on demand from the settings overlay, never automatically — running a
 * hotspot 24/7 has no benefit once the phone has connected once and just
 * burns power / interferes with WiFi scanning.
 */
class HotspotManager(context: Context) {

    private val wifiManager = context.applicationContext
        .getSystemService(Context.WIFI_SERVICE) as WifiManager
    private val mainHandler = Handler(Looper.getMainLooper())

    private var reservation: WifiManager.LocalOnlyHotspotReservation? = null

    data class Credentials(val ssid: String, val passphrase: String)

    fun start(onReady: (Credentials?) -> Unit) {
        if (reservation != null) {
            val r = reservation!!.softApConfiguration
            onReady(Credentials(r.ssid ?: "", r.passphrase ?: ""))
            return
        }
        try {
            wifiManager.startLocalOnlyHotspot(object : WifiManager.LocalOnlyHotspotCallback() {
                override fun onStarted(res: WifiManager.LocalOnlyHotspotReservation) {
                    reservation = res
                    val conf = res.softApConfiguration
                    mainHandler.post { onReady(Credentials(conf.ssid ?: "", conf.passphrase ?: "")) }
                }

                override fun onStopped() {
                    reservation = null
                }

                override fun onFailed(reason: Int) {
                    reservation = null
                    mainHandler.post { onReady(null) }
                }
            }, mainHandler)
        } catch (e: SecurityException) {
            onReady(null) // missing location permission (API 26-28) — settings overlay surfaces this
        }
    }

    fun stop() {
        reservation?.close()
        reservation = null
    }

    fun isActive() = reservation != null
}
