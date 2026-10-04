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

  if (format === 'dwf') {
    return {
      ok: false,
      error: 'DWF bu surumde acilmiyor. Cizimi DWG veya DXF olarak kaydedip yeniden acin.',
    }
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { readDrawingBytes } = await import('./cad/readDrawing')
    const document = await readDrawingBytes(bytes, format)
    const layout = document.layouts.find((item) => item.isModel) ?? document.layouts[0]
    const entities = layout?.entities ?? []
    const warning = document.warnings[0]
    return {
      ok: true,
      file: {
        name: file.name,
        size: file.size,
        format,
        source,
        document,
        layoutName: layout?.name ?? 'Model',
        entities,
        message: [
          `${document.version} · ${entities.length} nesne`,
          layout ? layout.name : '',
          warning ?? '',
        ].filter(Boolean).join(' · '),
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dosya okunamadi.'
    return { ok: false, error: message }
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
