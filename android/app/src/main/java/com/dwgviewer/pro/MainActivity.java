package com.dwgviewer.pro;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "DWGViewer";
    private static final String OPEN_FILE_EVENT = "dwg-viewer-open-file";
    private static final String OPEN_ERROR_EVENT = "dwg-viewer-open-error";
    private boolean nativeBridgeInstalled = false;
    private byte[] pendingFileBytes;
    private int cssTop;
    private int cssBottom;
    private int cssLeft;
    private int cssRight;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIncomingFileIntent(getIntent());
    }

    @Override
    public void onStart() {
        super.onStart();
        installNativeBridge();
        applySafeAreaInsets();
    }

    @Override
    public void onResume() {
        super.onResume();
        applySafeAreaInsets();
    }

    private void applySafeAreaInsets() {
        if (bridge == null || bridge.getWebView() == null) return;

        WebView webView = bridge.getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            publishCssInsets(bars.top, bars.bottom, bars.left, bars.right);
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(webView);
        webView.post(() -> readAndPublishInsets(webView));
        for (long delay : new long[] { 200, 700, 1600, 3200 }) {
            webView.postDelayed(() -> readAndPublishInsets(webView), delay);
        }
    }

    private void readAndPublishInsets(WebView webView) {
        WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(webView);
        if (insets == null) return;
        Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
        publishCssInsets(bars.top, bars.bottom, bars.left, bars.right);
    }

    private void publishCssInsets(int topPx, int bottomPx, int leftPx, int rightPx) {
        float density = getResources().getDisplayMetrics().density;
        if (density <= 0f) density = 1f;
        cssTop = Math.round(topPx / density);
        cssBottom = Math.round(bottomPx / density);
        cssLeft = Math.round(leftPx / density);
        cssRight = Math.round(rightPx / density);
        injectCssInsets();
    }

    private void injectCssInsets() {
        if (bridge == null || bridge.getWebView() == null) return;
        String script = String.format(
            Locale.US,
            "(function(){var r=document.documentElement;r.style.setProperty('--safe-top','%dpx');r.style.setProperty('--safe-bottom','%dpx');r.style.setProperty('--safe-left','%dpx');r.style.setProperty('--safe-right','%dpx');if(window.__setSafeAreaInsets)window.__setSafeAreaInsets(%d,%d,%d,%d);})();",
            cssTop,
            cssBottom,
            cssLeft,
            cssRight,
            cssTop,
            cssBottom,
            cssLeft,
            cssRight
        );
        bridge.getWebView().evaluateJavascript(script, null);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingFileIntent(intent);
    }

    private void handleIncomingFileIntent(Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        Log.d(TAG, "Incoming intent action: " + action);

        String localPath = intent.getStringExtra("dwg_path");
        if (localPath != null && isDebuggable()) {
            final String path = localPath;
            new Thread(() -> {
                try {
                    File file = new File(path);
                    try (FileInputStream input = new FileInputStream(file)) {
                        byte[] bytes = readStream(input);
                        JSONObject payload = payloadFromBytes(bytes, file.getName(), "application/octet-stream", file.getAbsolutePath());
                        dispatchWindowEvent(OPEN_FILE_EVENT, payload, 600);
                    }
                } catch (Exception exception) {
                    dispatchOpenError(exception);
                }
            }).start();
            return;
        }

        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(action)) {
            uri = intent.getData();
            if (uri == null) {
                uri = getSharedUri(intent);
            }
        } else if (Intent.ACTION_SEND.equals(action)) {
            uri = getSharedUri(intent);
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            ArrayList<Uri> uris = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                uris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri.class);
            } else {
                uris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            }
            if (uris != null && !uris.isEmpty()) {
                uri = uris.get(0); // Sadece ilk dosyayi ac
            }
        }

        if (uri == null) {
            Log.d(TAG, "No URI found in intent");
            return;
        }

        Log.d(TAG, "Handling URI: " + uri.toString());
        final Uri fileUri = uri;
        final String intentType = intent.getType();

        new Thread(() -> {
            try {
                JSONObject payload = buildFilePayload(fileUri, intentType);
                Log.d(TAG, "File payload built successfully, dispatching event");
                dispatchWindowEvent(OPEN_FILE_EVENT, payload, 600);
            } catch (Exception exception) {
                Log.e(TAG, "Error building file payload", exception);
                dispatchOpenError(exception);
            }
        }).start();
    }

    private Uri getSharedUri(Intent intent) {
        Uri extraStream = null;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            extraStream = intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
        } else {
            Object raw = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (raw instanceof Uri) extraStream = (Uri) raw;
        }

        if (extraStream != null) return extraStream;

        ClipData clipData = intent.getClipData();
        if (clipData != null && clipData.getItemCount() > 0) {
            return clipData.getItemAt(0).getUri();
        }

        return null;
    }

    private JSONObject buildFilePayload(Uri uri, String fallbackMimeType) throws Exception {
        String mimeType = getContentResolver().getType(uri);
        if (mimeType == null || mimeType.trim().isEmpty()) mimeType = fallbackMimeType;
        if (mimeType == null || mimeType.trim().isEmpty()) mimeType = "application/octet-stream";

        String displayName = resolveDisplayName(uri);
        byte[] bytes = readUriBytes(uri);
        return payloadFromBytes(bytes, displayName, mimeType, "Paylasim > " + displayName);
    }

    private JSONObject payloadFromBytes(byte[] bytes, String displayName, String mimeType, String sourcePath) throws Exception {
        String sniffed = sniffExtension(bytes);
        displayName = ensureSupportedFileName(displayName, mimeType, sniffed);
        if (!isDrawingName(displayName)) {
            throw new IllegalArgumentException("Paylasilan dosya DWG, DXF veya PDF degil.");
        }
        Log.d(TAG, "Resolved name: " + displayName + ", Mime: " + mimeType + ", sniff: " + sniffed);
        JSONObject payload = new JSONObject();
        payload.put("id", sourcePath + ":" + displayName + ":" + bytes.length);
        payload.put("name", displayName);
        payload.put("mimeType", mimeType == null ? "application/octet-stream" : mimeType);
        payload.put("size", bytes.length);
        payload.put("sourcePath", sourcePath);
        if (bytes.length > 48 * 1024) {
            pendingFileBytes = bytes;
            payload.put("chunked", true);
        } else {
            pendingFileBytes = null;
            payload.put("chunked", false);
            payload.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
        }
        return payload;
    }

    private byte[] readUriBytes(Uri uri) throws Exception {
        try {
            getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {}
        try (InputStream input = getContentResolver().openInputStream(uri)) {
            if (input == null) throw new IllegalStateException("Dosya okunamadi.");
            return readStream(input);
        }
    }

    private byte[] readStream(InputStream input) throws Exception {
        try (InputStream source = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = source.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }

    private boolean isDebuggable() {
        return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private void dispatchOpenError(Exception exception) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("message", "Dosya acilamadi: " + exception.getMessage());
        } catch (Exception ignored) {}
        dispatchWindowEvent(OPEN_ERROR_EVENT, payload, 400);
    }

    private String sniffExtension(byte[] bytes) {
        int length = Math.min(bytes.length, 256);
        if (length == 0) return "";
        String head = new String(bytes, 0, length, StandardCharsets.ISO_8859_1);
        String trimmed = head.trim();
        if (trimmed.startsWith("AC10")) return ".dwg";
        if (trimmed.startsWith("%PDF")) return ".pdf";
        if (trimmed.startsWith("AutoCAD Binary DXF")) return ".dxf";
        String compact = trimmed.replace("\u0000", "");
        if (compact.contains("SECTION") || compact.startsWith("0")) return ".dxf";
        return "";
    }

    private boolean isDrawingName(String displayName) {
        String lowerName = displayName.toLowerCase(Locale.ROOT);
        return lowerName.endsWith(".dwg") || lowerName.endsWith(".dxf") || lowerName.endsWith(".dwf") || lowerName.endsWith(".pdf");
    }

    private String resolveDisplayName(Uri uri) {
        String displayName = null;

        if ("content".equals(uri.getScheme())) {
            try (Cursor cursor = getContentResolver().query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (index >= 0) displayName = cursor.getString(index);
                }
            } catch (Exception ignored) {}
        }

        if (displayName == null || displayName.trim().isEmpty()) {
            displayName = uri.getLastPathSegment();
        }

        if (displayName == null || displayName.trim().isEmpty()) {
            displayName = "whatsapp-drawing.dwg";
        }

        int slashIndex = Math.max(displayName.lastIndexOf('/'), displayName.lastIndexOf('\\'));
        if (slashIndex >= 0 && slashIndex + 1 < displayName.length()) {
            displayName = displayName.substring(slashIndex + 1);
        }

        return displayName;
    }

    private String ensureSupportedFileName(String displayName, String mimeType, String sniffed) {
        String lowerName = displayName.toLowerCase(Locale.ROOT);
        boolean named = isDrawingName(displayName);
        if (sniffed != null && !sniffed.isEmpty() && !lowerName.endsWith(sniffed)) {
            int dot = named ? displayName.lastIndexOf('.') : -1;
            String stem = dot > 0 ? displayName.substring(0, dot) : displayName;
            return stem + sniffed;
        }
        if (named) return displayName;

        String lowerMime = mimeType == null ? "" : mimeType.toLowerCase(Locale.ROOT);
        if (lowerMime.contains("pdf")) return displayName + ".pdf";
        if (lowerMime.contains("dxf")) return displayName + ".dxf";
        if (lowerMime.contains("dwf")) return displayName + ".dwf";
        if (lowerMime.contains("dwg") || lowerMime.contains("acad")) return displayName + ".dwg";
        return displayName;
    }

    private void dispatchWindowEvent(String eventName, JSONObject payload, long delayMs) {
        Handler handler = new Handler(Looper.getMainLooper());
        // Retry a few times to ensure the JS bridge is ready
        for (int attempt = 0; attempt < 10; attempt += 1) {
            long attemptDelay = delayMs + (attempt * 800L);
            handler.postDelayed(() -> {
                if (bridge != null && bridge.getWebView() != null) {
                    Log.d(TAG, "Triggering JS event: " + eventName + " (Attempt " + ") ");
                    bridge.triggerWindowJSEvent(eventName, payload.toString());
                }
            }, attemptDelay);
        }
    }

    private void installNativeBridge() {
        if (nativeBridgeInstalled || bridge == null || bridge.getWebView() == null) return;
        bridge.getWebView().addJavascriptInterface(new NativeActions(), "DwgNative");
        nativeBridgeInstalled = true;
    }

    private class NativeActions {
        @JavascriptInterface
        public String pullChunk(int offset, int length) {
            byte[] data = pendingFileBytes;
            if (data == null || offset < 0 || length <= 0 || offset >= data.length) return "";
            int end = Math.min(data.length, offset + length);
            return Base64.encodeToString(java.util.Arrays.copyOfRange(data, offset, end), Base64.NO_WRAP);
        }

        @JavascriptInterface
        public void clearPending() {
            pendingFileBytes = null;
        }

        @JavascriptInterface
        public void print() {
            runOnUiThread(() -> {
                try {
                    if (bridge == null || bridge.getWebView() == null) return;

                    WebView webView = bridge.getWebView();
                    PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    if (printManager == null) return;

                    PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter("DWG Viewer Pro");
                    printManager.print("DWG Viewer Pro", adapter, null);
                } catch (Exception exception) {
                    Log.e(TAG, "Native print failed", exception);
                    JSONObject payload = new JSONObject();
                    try {
                        payload.put("message", "Yazdirma acilamadi: " + exception.getMessage());
                    } catch (Exception ignored) {}
                    dispatchWindowEvent(OPEN_ERROR_EVENT, payload, 0);
                }
            });
        }
    }
}
