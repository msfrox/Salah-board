package lk.salahboard.time

import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress

/**
 * Minimal SNTP (RFC 2030) query — adapted from AOSP's frameworks/base
 * android.net.SntpClient (Apache-2.0), trimmed to exactly what this shell
 * needs: one blocking request, "give me true time now". Deliberately not a
 * library dependency (ARCHITECTURE.md/android/README.md: "never a
 * heavyweight dependency").
 */
object SntpClient {

    private const val NTP_PORT = 123
    private const val NTP_PACKET_SIZE = 48
    private const val NTP_MODE_CLIENT = 3
    private const val NTP_VERSION = 3
    private const val ORIGINATE_TIME_OFFSET = 24
    private const val TRANSMIT_TIME_OFFSET = 40
    private const val OFFSET_1900_TO_1970 = 2208988800L

    data class Result(val ntpTimeMs: Long, val roundTripMs: Long)

    /** Returns the NTP server's time at the moment this device received the
     * reply, or null on any failure (timeout, unreachable, malformed
     * reply) — the caller just keeps the previous offset, per the offline
     * guarantee (SPEC.md § Offline guarantee: network only ever improves
     * things, never required). */
    fun query(host: String, timeoutMs: Int = 5000): Result? {
        var socket: DatagramSocket? = null
        return try {
            socket = DatagramSocket()
            socket.soTimeout = timeoutMs
            val address = InetAddress.getByName(host)
            val buffer = ByteArray(NTP_PACKET_SIZE)
            buffer[0] = ((NTP_VERSION shl 3) or NTP_MODE_CLIENT).toByte()

            val requestTime = System.currentTimeMillis()
            writeTimeStamp(buffer, TRANSMIT_TIME_OFFSET, requestTime)

            val request = DatagramPacket(buffer, buffer.size, address, NTP_PORT)
            socket.send(request)

            val response = DatagramPacket(buffer, buffer.size)
            socket.receive(response)
            val responseTime = System.currentTimeMillis()

            val originateTime = readTimeStamp(buffer, ORIGINATE_TIME_OFFSET)
            if (originateTime != requestTime) return null // reply to a different request, ignore

            val transmitTime = readTimeStamp(buffer, TRANSMIT_TIME_OFFSET)
            val roundTrip = responseTime - requestTime
            val ntpTime = transmitTime + roundTrip / 2
            Result(ntpTime, roundTrip)
        } catch (e: Exception) {
            null
        } finally {
            socket?.close()
        }
    }

    private fun readTimeStamp(buffer: ByteArray, offset: Int): Long {
        val seconds = read32(buffer, offset)
        val fraction = read32(buffer, offset + 4)
        return ((seconds - OFFSET_1900_TO_1970) * 1000) + ((fraction * 1000L) / 0x100000000L)
    }

    private fun writeTimeStamp(buffer: ByteArray, offset: Int, timeMs: Long) {
        var seconds = timeMs / 1000
        val milliseconds = timeMs - seconds * 1000
        seconds += OFFSET_1900_TO_1970
        write32(buffer, offset, seconds)
        val fraction = (milliseconds * 0x100000000L) / 1000
        write32(buffer, offset + 4, fraction)
        buffer[offset + 7] = (buffer[offset + 7].toInt() or (Math.random() * 0xFF).toInt()).toByte()
    }

    private fun read32(buffer: ByteArray, offset: Int): Long {
        var result: Long = 0
        for (i in 0 until 4) {
            result = (result shl 8) or (buffer[offset + i].toLong() and 0xFF)
        }
        return result
    }

    private fun write32(buffer: ByteArray, offset: Int, value: Long) {
        var v = value
        for (i in 3 downTo 0) {
            buffer[offset + i] = (v and 0xFF).toByte()
            v = v shr 8
        }
    }
}
