package lk.salahboard

import android.app.Application
import android.content.Context
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.util.Date

/**
 * Last-crash capture for a device with no adb attached (the whole point
 * of this app is running unattended on a wall). The uncaught-exception
 * handler writes the stack trace to files/crash.log before the process
 * dies; it's then readable at GET /api/crash from a phone browser, and
 * MainActivity shows it full-screen if startup itself is what failed.
 */
object CrashLog {

    fun file(context: Context): File = File(context.filesDir, "crash.log")

    fun write(context: Context, t: Throwable) {
        try {
            val sw = StringWriter()
            t.printStackTrace(PrintWriter(sw))
            file(context).writeText("${Date()}\n$sw")
        } catch (_: Exception) {
            // Nothing sane to do if even logging fails.
        }
    }

    fun read(context: Context): String? =
        try { file(context).takeIf { it.exists() }?.readText() } catch (_: Exception) { null }

    fun install(app: Application) {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            write(app, throwable)
            previous?.uncaughtException(thread, throwable)
        }
    }
}
