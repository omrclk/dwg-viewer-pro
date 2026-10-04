-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.dwgviewer.pro.MainActivity$NativeActions { *; }
-dontwarn com.google.android.play.core.**
