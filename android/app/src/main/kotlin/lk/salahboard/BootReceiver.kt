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
        // Both calls best-effort: background-launch rules differ per
        // OEM/API level, and as the HOME app we get launched at boot by
        // the launcher path anyway — this receiver is a backup, and a
        // backup must not crash the process it's backing up.
        try {
            val launch = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(launch)
        } catch (e: Exception) {
            CrashLog.write(context, e)
        }
        try {
            context.startForegroundService(Intent(context, WatchdogService::class.java))
        } catch (e: Exception) {
            CrashLog.write(context, e)
        }
    }
}
