package lk.salahboard

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import androidx.core.app.NotificationCompat

/**
 * Foreground service backing "watchdog relaunches the activity if it dies"
 * (D3). MainActivity pokes [MainActivityState.lastForegroundAtMs] on every
 * resume; if this service doesn't see a poke for [STALE_MS] it assumes the
 * WebView/activity died and restarts it via the HOME intent. Acceptance
 * target: back on screen within 10s of a crash/kill (MILESTONES.md M3).
 */
class WatchdogService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private val checkRunnable = object : Runnable {
        override fun run() {
            val idleMs = SystemClock.elapsedRealtime() - MainActivityState.lastForegroundAtMs
            if (idleMs > STALE_MS) relaunch()
            handler.postDelayed(this, CHECK_INTERVAL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        handler.removeCallbacks(checkRunnable)
        handler.postDelayed(checkRunnable, CHECK_INTERVAL_MS)
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(checkRunnable)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun relaunch() {
        MainActivityState.lastForegroundAtMs = SystemClock.elapsedRealtime() // avoid relaunch storms
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        startActivity(intent)
    }

    private fun buildNotification(): android.app.Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Display watchdog", NotificationManager.IMPORTANCE_MIN)
            (getSystemService(NotificationManager::class.java)).createNotificationChannel(channel)
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Salah Board")
            .setContentText("Keeping the prayer-time display on screen")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "watchdog"
        private const val NOTIFICATION_ID = 1
        private const val CHECK_INTERVAL_MS = 3000L
        private const val STALE_MS = 10_000L
    }
}

object MainActivityState {
    @Volatile var lastForegroundAtMs: Long = SystemClock.elapsedRealtime()
}
