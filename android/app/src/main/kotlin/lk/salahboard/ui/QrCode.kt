package lk.salahboard.ui

import android.graphics.Bitmap
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter

/** Bundled QR rendering (offline guarantee: no CDN, no external requests —
 * ARCHITECTURE.md / SPEC.md § Offline guarantee #2). Used by the settings
 * overlay for the admin-panel URL and hotspot credentials. */
object QrCode {
    fun render(text: String, sizePx: Int = 480): Bitmap {
        val matrix = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, sizePx, sizePx)
        val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.RGB_565)
        for (x in 0 until sizePx) {
            for (y in 0 until sizePx) {
                bitmap.setPixel(x, y, if (matrix[x, y]) 0xFF000000.toInt() else 0xFFFFFFFF.toInt())
            }
        }
        return bitmap
    }

    /** WPA2 WiFi QR payload per the standard `WIFI:` URI scheme, so any
     * phone camera app can join the hotspot without typing the password. */
    fun wifiPayload(ssid: String, passphrase: String): String =
        "WIFI:T:WPA;S:${escape(ssid)};P:${escape(passphrase)};;"

    private fun escape(s: String) = s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace(":", "\\:")
}
