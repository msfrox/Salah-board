package lk.salahboard.net

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Build
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

    // softApConfiguration is API 30+; minSdk-26 boxes (Android 8–10) only
    // have the deprecated wifiConfiguration on the reservation.
    private fun credentialsOf(res: WifiManager.LocalOnlyHotspotReservation): Credentials =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val c = res.softApConfiguration
            Credentials(c.ssid ?: "", c.passphrase ?: "")
        } else {
            @Suppress("DEPRECATION")
            val c = res.wifiConfiguration
            Credentials(c?.SSID ?: "", c?.preSharedKey ?: "")
        }

    fun start(onReady: (Credentials?) -> Unit) {
        reservation?.let {
            onReady(credentialsOf(it))
            return
        }
        try {
            wifiManager.startLocalOnlyHotspot(object : WifiManager.LocalOnlyHotspotCallback() {
                override fun onStarted(res: WifiManager.LocalOnlyHotspotReservation) {
                    reservation = res
                    val creds = credentialsOf(res)
                    mainHandler.post { onReady(creds) }
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
