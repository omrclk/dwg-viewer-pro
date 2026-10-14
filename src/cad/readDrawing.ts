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

type AttributeInsert = { applyAttributeTransform?: (attribute: unknown) => void }
type AttributeTemplate = { cadObject?: AttributeInsert; _build: (builder: unknown) => void; __dwgAttributeFix?: boolean }

/**
 * acad-ts applies the insert transform again while loading ATTRIB entities.
 * The file already stores them in world space (ACadSharp does not transform
 * them on read), so a scaled block stamp was drawn many times too large.
 */
export function keepFileAttributePlacement(template: { prototype: AttributeTemplate }) {
  const proto = template.prototype
  if (proto.__dwgAttributeFix) return
  const original = proto._build
  proto._build = function buildWithoutAttributeRescale(this: { cadObject?: AttributeInsert }, builder: unknown) {
    const insert = this.cadObject
    const apply = insert?.applyAttributeTransform
    if (insert && apply) insert.applyAttributeTransform = () => undefined
    try {
      return original.call(this, builder)
    } finally {
      if (insert && apply) insert.applyAttributeTransform = apply
    }
  }
  proto.__dwgAttributeFix = true
}

export async function readDrawingBytes(bytes: Uint8Array, format: 'dwg' | 'dxf'): Promise<DrawingDocument> {
  const acad = await import('@node-projects/acad-ts')
  keepFileAttributePlacement(acad.CadInsertTemplate as unknown as { prototype: AttributeTemplate })
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
      fallback.warnings.unshift('DXF, yerleşik okuyucu ile açıldı.')
      return fallback
    }
    const message = error instanceof Error ? error.message : 'okunamadı'
    if (format === 'dwg') {
      throw new Error(`DWG açılamadı (${message}). R14 ve daha yeni dosyalar desteklenir. R12 DWG için dosyayı DXF olarak kaydedin.`)
    }
    throw new Error(`DXF açılamadı (${message}).`)
  }
}
