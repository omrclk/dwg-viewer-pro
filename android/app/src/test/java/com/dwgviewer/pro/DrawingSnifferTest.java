package com.dwgviewer.pro;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import org.junit.Test;

public class DrawingSnifferTest {
    @Test
    public void ac10HeaderIsDwgForEverySupportedRelease() {
        String[] versions = {"AC1014", "AC1015", "AC1018", "AC1021", "AC1024", "AC1027", "AC1032"};
        for (String version : versions) {
            byte[] bytes = (version + " rest of header").getBytes(StandardCharsets.US_ASCII);
            assertEquals(version, ".dwg", DrawingSniffer.sniffExtension(bytes));
        }
    }

    @Test
    public void asciiAndBinaryDxfAndPdf() {
        assertEquals(".dxf", DrawingSniffer.sniffExtension("0\nSECTION\n2\nHEADER\n".getBytes(StandardCharsets.US_ASCII)));
        assertEquals(".dxf", DrawingSniffer.sniffExtension("AutoCAD Binary DXF\r\n".getBytes(StandardCharsets.US_ASCII)));
        assertEquals(".pdf", DrawingSniffer.sniffExtension("%PDF-1.4\n".getBytes(StandardCharsets.US_ASCII)));
        assertEquals("", DrawingSniffer.sniffExtension("not a drawing".getBytes(StandardCharsets.US_ASCII)));
        assertEquals("", DrawingSniffer.sniffExtension(new byte[0]));
    }

    @Test
    public void whatsAppStyleNameWithoutExtensionUsesMagicBytes() {
        byte[] dwg = "AC1027\0\0plan".getBytes(StandardCharsets.ISO_8859_1);
        assertEquals(".dwg", DrawingSniffer.sniffExtension(dwg));
        assertEquals("Mimari plan.dwg", DrawingSniffer.ensureFileName("Mimari plan", "application/octet-stream", ".dwg"));
        assertEquals("123.dwg", DrawingSniffer.ensureFileName("content://com.whatsapp.provider.media/item/123", "application/octet-stream", ".dwg"));
        assertEquals("item.dwg", DrawingSniffer.ensureFileName("item", "application/octet-stream", ".dwg"));
        assertEquals("kat-plani.dwg", DrawingSniffer.ensureFileName("kat-plani.dwg", "application/octet-stream", ".dwg"));
    }

    @Test
    public void bipContentNameAndWrongExtensionFollowTheHeader() {
        assertEquals("proje.dwg", DrawingSniffer.ensureFileName("proje.jpg", "application/octet-stream", ".dwg"));
        assertEquals("kesit.dxf", DrawingSniffer.ensureFileName("kesit.bin", "*/*", ".dxf"));
        assertEquals("cizim.dwg", DrawingSniffer.ensureFileName("  ", "application/octet-stream", ".dwg"));
        assertFalse(DrawingSniffer.isDrawingName("item/123"));
        assertTrue(DrawingSniffer.isDrawingName("plan.DXF"));
    }

    @Test
    public void octetStreamWithoutCadHeaderIsNotForcedToDwg() {
        assertEquals("foto.jpg", DrawingSniffer.ensureFileName("foto.jpg", "application/octet-stream", ""));
        assertEquals("not", DrawingSniffer.ensureFileName("not", "application/octet-stream", ""));
        assertFalse(DrawingSniffer.acceptsSharedBytes("not", ""));
        assertFalse(DrawingSniffer.acceptsSharedBytes("foto.jpg", ""));
        assertTrue(DrawingSniffer.acceptsSharedBytes("not", ".dwg"));
        assertTrue(DrawingSniffer.acceptsSharedBytes("plan.dwg", ""));
        assertEquals("plan.dwg", DrawingSniffer.ensureFileName("plan.bin", "application/octet-stream", ".dwg"));
    }
}
