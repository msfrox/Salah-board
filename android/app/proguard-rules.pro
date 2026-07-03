# JS bridge methods are called by reflection from the WebView.
-keepclassmembers class lk.salahboard.JsBridge {
    public *;
}
-keep class fi.iki.elonen.** { *; }
