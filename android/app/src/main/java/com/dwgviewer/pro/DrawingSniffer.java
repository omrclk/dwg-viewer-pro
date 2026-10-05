package com.dwgviewer.pro;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Pure header checks so a messenger URI without a file extension still opens as DWG or DXF. */
public final class DrawingSniffer {
    private DrawingSniffer() {}

    public static String sniffExtension(byte[] bytes) {
        if (bytes == null || bytes.length == 0) return "";
        int length = Math.min(bytes.length, 256);
        String head = new String(bytes, 0, length, StandardCharsets.ISO_8859_1);
        if (head.startsWith("AC10")) return ".dwg";
        String trimmed = head.trim();
        if (trimmed.startsWith("%PDF")) return ".pdf";
        if (trimmed.startsWith("AutoCAD Binary DXF")) return ".dxf";
        String compact = trimmed.replace("\u0000", "");
        if (compact.contains("SECTION") || compact.startsWith("0")) return ".dxf";
        return "";
    }

    public static boolean isDrawingName(String displayName) {
        if (displayName == null) return false;
        String lowerName = displayName.toLowerCase(Locale.ROOT);
        return lowerName.endsWith(".dwg")
            || lowerName.endsWith(".dxf")
            || lowerName.endsWith(".dwf")
            || lowerName.endsWith(".pdf");
    }

    public static String ensureFileName(String displayName, String mimeType, String sniffed) {
        String name = displayName == null ? "" : displayName.trim();
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        if (slash >= 0 && slash + 1 < name.length()) name = name.substring(slash + 1);
        if (name.isEmpty()) name = "cizim";

        String lowerName = name.toLowerCase(Locale.ROOT);
        if (sniffed != null && !sniffed.isEmpty() && !lowerName.endsWith(sniffed)) {
            int dot = name.lastIndexOf('.');
            String stem = dot > 0 ? name.substring(0, dot) : name;
            if (stem.isEmpty()) stem = "cizim";
            return stem + sniffed;
        }
        if (isDrawingName(name)) return name;

        String lowerMime = mimeType == null ? "" : mimeType.toLowerCase(Locale.ROOT);
        if (lowerMime.contains("pdf")) return name + ".pdf";
        if (lowerMime.contains("dxf")) return name + ".dxf";
        if (lowerMime.contains("dwf")) return name + ".dwf";
        if (lowerMime.contains("dwg") || lowerMime.contains("acad") || lowerMime.contains("octet-stream")) return name + ".dwg";
        return name;
    }
}
