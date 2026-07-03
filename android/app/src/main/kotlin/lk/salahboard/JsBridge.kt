package lk.salahboard

import android.app.Activity
import android.webkit.JavascriptInterface
import android.webkit.WebView
import lk.salahboard.config.ConfigStore

/**
 * `window.SalahBridge` in the WebView — the small surface listed in
 * ARCHITECTURE.md ("Shell responsibilities" #7). Config itself goes
 * through the HTTP API (D8), not this bridge; this only carries things
 * the web layer genuinely cannot do itself: real backlight control and a
 * read of the shell's status/offset for diagnostics screens.
 */
class JsBridge(private val activity: Activity, private val configStore: ConfigStore) {

    @JavascriptInterface
    fun getTimeOffsetMs(): Long = configStore.currentOffsetMs()

    @JavascriptInterface
    fun getStatusJson(): String = configStore.read().optJSONObject("time")?.toString() ?: "{}"

    /** percent: 0 (darkest) .. 100 (full brightness). Applied via the
     * window's LayoutParams, not a system-wide brightness change — never
     * touches settings outside this app. */
    @JavascriptInterface
    fun setBrightness(percent: Int) {
        val clamped = percent.coerceIn(0, 100)
        activity.runOnUiThread {
            val window = activity.window
            val attrs = window.attributes
            attrs.screenBrightness = clamped / 100f
            window.attributes = attrs
        }
    }

    companion object {
        const val NAME = "SalahBridge"
        fun install(webView: WebView, activity: Activity, configStore: ConfigStore) {
            webView.addJavascriptInterface(JsBridge(activity, configStore), NAME)
        }
    }
}
