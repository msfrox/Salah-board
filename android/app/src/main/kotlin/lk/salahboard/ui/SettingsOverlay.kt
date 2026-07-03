package lk.salahboard.ui

import android.app.Activity
import android.app.Dialog
import android.content.Context
import android.net.wifi.WifiManager
import android.text.format.Formatter
import android.view.Window
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import lk.salahboard.R
import lk.salahboard.config.ConfigStore
import lk.salahboard.data.DataRefresh
import lk.salahboard.net.HotspotManager
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * TV-remote settings overlay (M4) — opened by MainActivity on remote
 * long-press / menu key. Every control is a plain focusable Button/View so
 * D-pad up/down/left/right + OK/back work with zero extra wiring; this is
 * the "airplane test" path (SPEC.md § Offline guarantee): no phone, no
 * WiFi, still fully configurable.
 */
class SettingsOverlay(
    private val activity: Activity,
    private val configStore: ConfigStore,
    private val dataRefresh: DataRefresh,
    private val port: Int,
    private val onConfigChanged: () -> Unit,
) {
    private val hotspotManager = HotspotManager(activity)
    private var dialog: Dialog? = null
    private lateinit var currentTimeText: TextView

    /** [sanityWarning] is set by MainActivity's boot check when the system
     * clock looks implausible and NTP isn't reachable — same overlay, just
     * opened automatically with a banner instead of waiting for a
     * long-press (D5 boot sanity screen). */
    fun show(sanityWarning: String? = null) {
        if (dialog?.isShowing == true) return
        val dialog = Dialog(activity, android.R.style.Theme_Black_NoTitleBar_Fullscreen)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        dialog.setContentView(R.layout.overlay_settings)
        this.dialog = dialog

        currentTimeText = dialog.findViewById(R.id.currentTimeText)
        if (sanityWarning != null) {
            dialog.findViewById<TextView>(R.id.overlayTitle).text = sanityWarning
        }
        bindAdminUrl(dialog)
        bindHotspot(dialog)
        bindTimeButtons(dialog)
        bindDataRefresh(dialog)
        refreshTimeText()

        dialog.findViewById<Button>(R.id.closeButton).setOnClickListener { dismiss() }
        dialog.setOnDismissListener { hotspotManager.stop() }
        dialog.setCancelable(sanityWarning == null) // can't back out of the sanity screen with wrong-clock unresolved
        dialog.show()
    }

    fun dismiss() {
        dialog?.dismiss()
        dialog = null
    }

    fun isShowing(): Boolean = dialog?.isShowing == true

    private fun bindAdminUrl(dialog: Dialog) {
        val wifiManager = activity.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        val ip = try {
            Formatter.formatIpAddress(wifiManager.connectionInfo.ipAddress)
        } catch (e: Exception) {
            null
        }
        val url = if (ip != null && ip != "0.0.0.0") "http://$ip:$port/admin/" else null
        dialog.findViewById<TextView>(R.id.adminUrlText).text = url ?: "Connect to WiFi or start the hotspot below"
        val qr = dialog.findViewById<ImageView>(R.id.adminQr)
        if (url != null) qr.setImageBitmap(QrCode.render(url)) else qr.setImageBitmap(null)
    }

    private fun bindHotspot(dialog: Dialog) {
        val toggle = dialog.findViewById<Button>(R.id.hotspotToggleButton)
        val qr = dialog.findViewById<ImageView>(R.id.hotspotQr)
        val status = dialog.findViewById<TextView>(R.id.hotspotStatusText)

        toggle.setOnClickListener {
            if (hotspotManager.isActive()) {
                hotspotManager.stop()
                toggle.text = "Start hotspot"
                qr.visibility = android.view.View.GONE
                status.text = ""
                return@setOnClickListener
            }
            status.text = "Starting hotspot…"
            hotspotManager.start { creds ->
                if (creds == null) {
                    status.text = "Couldn't start hotspot (check location permission)"
                    return@start
                }
                toggle.text = "Stop hotspot"
                qr.visibility = android.view.View.VISIBLE
                qr.setImageBitmap(QrCode.render(QrCode.wifiPayload(creds.ssid, creds.passphrase)))
                status.text = "${creds.ssid} — then open http://192.168.49.1:$port/admin/"
            }
        }
    }

    private fun bindTimeButtons(dialog: Dialog) {
        val steps = mapOf(
            R.id.timeMinusDay to -24 * 60 * 60_000L,
            R.id.timeMinusHour to -60 * 60_000L,
            R.id.timeMinus10Min to -10 * 60_000L,
            R.id.timeMinus1Min to -60_000L,
            R.id.timePlus1Min to 60_000L,
            R.id.timePlus10Min to 10 * 60_000L,
            R.id.timePlusHour to 60 * 60_000L,
            R.id.timePlusDay to 24 * 60 * 60_000L,
        )
        for ((id, deltaMs) in steps) {
            dialog.findViewById<Button>(id).setOnClickListener {
                val newOffset = configStore.currentOffsetMs() + deltaMs
                configStore.updateTime(newOffset, "manual")
                refreshTimeText()
                onConfigChanged()
            }
        }
    }

    private fun bindDataRefresh(dialog: Dialog) {
        val button = dialog.findViewById<Button>(R.id.dataRefreshButton)
        button.setOnClickListener {
            button.isEnabled = false
            button.text = "Checking…"
            Thread {
                val zone = configStore.read().optString("zone", "01")
                val result = dataRefresh.refresh(zone)
                activity.runOnUiThread {
                    button.isEnabled = true
                    button.text = when {
                        result.error != null -> "Check failed — no internet?"
                        result.updated.isEmpty() -> "Already up to date"
                        else -> "Updated ${result.updated.size} month(s)"
                    }
                    if (result.updated.isNotEmpty()) onConfigChanged()
                }
            }.start()
        }
    }

    private fun refreshTimeText() {
        val fmt = SimpleDateFormat("EEE d MMM yyyy, HH:mm:ss", Locale.US)
        currentTimeText.text = fmt.format(Date(configStore.correctedNowMs()))
    }
}
