import { parseDxfEntities } from './dxfParser'
import type { FileSource, OpenedFile } from './fileTypes'
import { getFormat } from './fileTypes'
import { addRecentFile } from './recentFiles'

export type OpenFileResult =
  | { ok: true; file: OpenedFile; objectUrl?: string }
  | { ok: false; error: string }

export async function buildOpenedFile(
  file: File,
  source: FileSource,
  options?: { skipRecent?: boolean },
): Promise<OpenFileResult> {
  const format = getFormat(file.name)

  if (!format) {
    return { ok: false, error: 'Sadece DWG, DXF, DWF ve PDF dosyalari acilabilir.' }
  }

  if (!options?.skipRecent) {
    await addRecentFile(file, format, source)
  }

  if (format === 'pdf') {
    const objectUrl = URL.createObjectURL(file)
    return {
      ok: true,
      objectUrl,
      file: { name: file.name, size: file.size, format, source, url: objectUrl },
    }
  }

  if (format === 'dxf') {
    const text = await file.text()
    const entities = parseDxfEntities(text)
    return {
      ok: true,
      file: {
        name: file.name,
        size: file.size,
        format,
        source,
        entities,
        message: entities.length
          ? `${entities.length} DXF nesnesi yuklendi.`
          : 'DXF acildi fakat desteklenen cizim nesnesi bulunamadi.',
      },
    }
  }

  return {
    ok: true,
    file: {
      name: file.name,
      size: file.size,
      format,
      source,
      message:
        format === 'dwg'
          ? 'DWG dosyasi acildi. Tam DWG render icin native/wasm CAD motoru baglanmalidir.'
          : 'DWF dosyasi secildi. Tam DWF render icin native/wasm CAD motoru baglanmalidir.',
    },
  }
}

export function pickDeviceFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = [
      '.dwg',
      '.dxf',
      '.dwf',
      '.pdf',
      'application/pdf',
      'application/acad',
      'application/autocad_dwg',
      'application/dwg',
      'application/dxf',
      'application/dwf',
      'application/octet-stream',
      'application/x-acad',
      'application/x-autocad',
      'application/x-dwg',
      'application/x-dxf',
      'application/x-dwf',
      'image/vnd.dwg',
      'image/vnd.dxf',
    ].join(',')
    input.multiple = false
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}
