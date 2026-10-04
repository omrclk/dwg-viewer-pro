import type { DrawingDocument } from '../drawingTypes'
import { parseDxfDocument } from '../dxfParser'
import { flattenCadDocument } from './flattenDocument'

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function looksLikeAsciiDxf(bytes: Uint8Array) {
  const head = new TextDecoder().decode(bytes.slice(0, 64)).trimStart()
  return head.startsWith('0') || head.startsWith('999') || head.includes('SECTION')
}

export async function readDrawingBytes(bytes: Uint8Array, format: 'dwg' | 'dxf'): Promise<DrawingDocument> {
  const acad = await import('@node-projects/acad-ts')
  const notes: string[] = []
  try {
    const doc = format === 'dwg'
      ? acad.DwgReader.readFromStream(toArrayBuffer(bytes), (_sender, event) => {
          if (event?.message) notes.push(String(event.message))
        })
      : acad.DxfReader.readFromStream(bytes, (_sender, event) => {
          if (event?.message) notes.push(String(event.message))
        })
    const drawing = flattenCadDocument(doc, format)
    if (notes.length) drawing.warnings.push(...notes.slice(0, 4))
    const total = drawing.layouts.reduce((sum, layout) => sum + layout.entities.length, 0)
    if (!total && format === 'dxf' && looksLikeAsciiDxf(bytes)) {
      return parseDxfDocument(new TextDecoder().decode(bytes))
    }
    return drawing
  } catch (error) {
    if (format === 'dxf' && looksLikeAsciiDxf(bytes)) {
      const fallback = parseDxfDocument(new TextDecoder().decode(bytes))
      fallback.warnings.unshift('DXF, yerlesik okuyucu ile acildi.')
      return fallback
    }
    const message = error instanceof Error ? error.message : 'okunamadi'
    if (format === 'dwg') {
      throw new Error(`DWG acilamadi (${message}). R14 ve daha yeni dosyalar desteklenir. R12 DWG icin dosyayi DXF olarak kaydedin.`)
    }
    throw new Error(`DXF acilamadi (${message}).`)
  }
}
