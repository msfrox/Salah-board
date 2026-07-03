package lk.salahboard

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** BOOT_COMPLETED backup for the HOME-launcher registration (D3) — most
 * launchers restore the last foreground app on boot anyway, but this
 * guarantees it on the ones that don't. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val launch = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(launch)
        context.startForegroundService(Intent(context, WatchdogService::class.java))
    }
}
