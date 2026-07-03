package lk.salahboard

import android.annotation.SuppressLint
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.GestureDetector
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import lk.salahboard.data.DataRefresh
import lk.salahboard.server.SalahHttpServer
import lk.salahboard.ui.SettingsOverlay
import java.util.Calendar

/**
 * Single-activity kiosk shell (D2/D3). Everything display-related is the
 * WebView pointed at the embedded server; this class only does what the
 * web layer can't: fullscreen/keep-awake, server lifecycle, JS bridge,
 * and the remote-control settings overlay.
 */
class MainActivity : AppCompatActivity() {

    private val port = 8080
    private lateinit var webView: WebView
    private lateinit var server: SalahHttpServer
    private lateinit var settingsOverlay: SettingsOverlay
    private var longPressHandled = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // A kiosk that silently crash-loops is undebuggable in the field
        // (no adb on a wall-mounted box). If startup fails, persist the
        // trace (also served at /api/crash) and show it full-screen so a
        // photo of the TV is a complete bug report.
        try {
            startKiosk()
        } catch (t: Throwable) {
            CrashLog.write(this, t)
            showStartupFailure(t)
        }
    }

    private fun startKiosk() {
        val app = SalahBoardApp.from(application)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        applyImmersive()

        val dataRefresh = DataRefresh(this)
        server = SalahHttpServer(this, port, app.configStore, dataRefresh, onConfigChanged = ::reloadWebView)
        server.start()

        settingsOverlay = SettingsOverlay(this, app.configStore, dataRefresh, port, onConfigChanged = ::reloadWebView)

        webView = WebView(this)
        setContentView(webView)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true // localStorage fallback path in config.js
        webView.settings.cacheMode = WebSettings.LOAD_NO_CACHE // config/content changes must show immediately
        webView.webViewClient = WebViewClient()
        JsBridge.install(webView, this, app.configStore)
        webView.loadUrl("http://localhost:$port/")
        installTapToOpenSettings()

        try {
            startForegroundService(android.content.Intent(this, WatchdogService::class.java))
        } catch (e: Exception) {
            CrashLog.write(this, e) // display runs without a watchdog rather than not at all
        }
        checkBootSanity(app)
    }

    private fun showStartupFailure(t: Throwable) {
        val text = TextView(this).apply {
            text = "Salah Board failed to start\n\n${Log.getStackTraceString(t)}"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.BLACK)
            typeface = Typeface.MONOSPACE
            textSize = 12f
            setPadding(48, 48, 48, 48)
        }
        setContentView(ScrollView(this).apply {
            setBackgroundColor(Color.BLACK)
            addView(text)
        })
    }

    override fun onResume() {
        super.onResume()
        MainActivityState.lastForegroundAtMs = SystemClock.elapsedRealtime()
        applyImmersive()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyImmersive()
    }

    override fun onDestroy() {
        if (::server.isInitialized) server.stop() // never initialized if startKiosk() failed early
        super.onDestroy()
    }

    private fun applyImmersive() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.let {
                it.hide(android.view.WindowInsets.Type.systemBars())
                it.systemBarsBehavior = android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                )
        }
    }

    private fun reloadWebView() {
        runOnUiThread { webView.reload() }
    }

    /** Touch-screen equivalent of the remote long-press (D-pad boxes have
     * no touch, phones/tablets running the display have no remote): a
     * single tap anywhere on the display opens the same settings overlay.
     * The display itself has no interactive elements, so it's safe to
     * swallow every tap here rather than let it fall through to the
     * WebView. */
    @SuppressLint("ClickableViewAccessibility")
    private fun installTapToOpenSettings() {
        val detector = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onSingleTapConfirmed(e: MotionEvent): Boolean {
                if (!settingsOverlay.isShowing()) settingsOverlay.show()
                return true
            }
        })
        webView.setOnTouchListener { _, event -> detector.onTouchEvent(event) }
    }

    /** D5: implausible clock + no NTP fix -> open the settings overlay
     * (QR + D-pad time adjust) instead of ever showing a wrong prayer
     * time. Runs off the UI thread since it may block briefly on a
     * network timeout. */
    private fun checkBootSanity(app: SalahBoardApp) {
        Thread {
            val plausible = isClockPlausible()
            if (plausible) return@Thread
            val synced = app.timeSync.syncOnce()
            if (!synced) {
                runOnUiThread {
                    settingsOverlay.show("Clock looks wrong and there's no internet — set the time below")
                }
            } else {
                reloadWebView()
            }
        }.start()
    }

    private fun isClockPlausible(): Boolean {
        val year = Calendar.getInstance().get(Calendar.YEAR)
        return year >= MIN_PLAUSIBLE_YEAR
    }

    // ── Remote-control settings overlay: long-press OK/Enter or MENU ──
    override fun onKeyLongPress(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER || keyCode == KeyEvent.KEYCODE_MENU) {
            longPressHandled = true
            if (::settingsOverlay.isInitialized) settingsOverlay.show()
            return true
        }
        return super.onKeyLongPress(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        // Only the tracked keys consume/clear the long-press flag — an
        // unrelated key-up (volume, D-pad move) must not reset it between
        // MENU's long-press callback and MENU's own key-up.
        if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER || keyCode == KeyEvent.KEYCODE_MENU) {
            val wasLongPress = longPressHandled
            longPressHandled = false
            if (keyCode == KeyEvent.KEYCODE_MENU && !wasLongPress) {
                if (::settingsOverlay.isInitialized) settingsOverlay.show()
                return true
            }
        }
        return super.onKeyUp(keyCode, event)
    }

    override fun onBackPressed() {
        if (::settingsOverlay.isInitialized && settingsOverlay.isShowing()) {
            settingsOverlay.dismiss()
        } else {
            // HOME-launcher app (D3): back should never exit to a launcher
            // chooser or leave the display unattended.
            moveTaskToBack(true)
        }
    }

    companion object {
        // Bumped occasionally; a device reporting an earlier year than
        // this is almost certainly a dead-RTC boot at epoch, not reality.
        private const val MIN_PLAUSIBLE_YEAR = 2025
    }
}
