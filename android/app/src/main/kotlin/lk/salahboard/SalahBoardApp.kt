package lk.salahboard

import android.app.Application
import lk.salahboard.config.ConfigStore
import lk.salahboard.time.TimeSync

class SalahBoardApp : Application() {

    lateinit var configStore: ConfigStore
        private set
    lateinit var timeSync: TimeSync
        private set

    override fun onCreate() {
        super.onCreate()
        configStore = ConfigStore(this)
        timeSync = TimeSync(configStore)
        timeSync.start()
    }

    companion object {
        fun from(app: Application): SalahBoardApp = app as SalahBoardApp
    }
}
