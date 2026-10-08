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
    const model = document.layouts.find((item) => item.isModel && item.entities.length)
    const layout = model ?? [...document.layouts].sort((a, b) => b.entities.length - a.entities.length)[0]
    const entities = layout?.entities ?? []
    if (!entities.length) {
      return {
        ok: false,
        error: `${format.toUpperCase()} okundu (${document.version}) ama cizilecek nesne yok. Bu surum veya nesne tipleri desteklenmiyor olabilir.`,
      }
    }
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

const DEVICE_ACCEPT = [
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

export type DeviceFileInput = {
  files: FileList | File[] | null
  value: string
  accept?: string
  multiple?: boolean
  style?: { cssText?: string }
  click: () => void
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
  remove?: () => void
}

/** Resolves once, on change or cancel, and clears the input so the same file can be chosen again. */
export function bindDeviceFileInput(input: DeviceFileInput, resolve: (file: File | null) => void) {
  let settled = false
  const finish = (file: File | null) => {
    if (settled) return
    settled = true
    input.value = ''
    resolve(file)
  }
  const onChange = () => {
    const list = input.files
    const file = list && 'item' in list ? list.item(0) : list?.[0]
    finish(file ?? null)
  }
  const onCancel = () => finish(null)
  input.addEventListener('change', onChange)
  input.addEventListener('cancel', onCancel)
  return () => {
    input.removeEventListener('change', onChange)
    input.removeEventListener('cancel', onCancel)
  }
}

export function pickDeviceFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = DEVICE_ACCEPT
    input.multiple = false
    input.value = ''
    input.setAttribute('aria-hidden', 'true')
    input.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0.01'
    let settled = false
    let focusTimer = 0
    const unbind = bindDeviceFileInput(input, (file) => {
      if (settled) return
      settled = true
      window.clearTimeout(armTimer)
      window.clearTimeout(focusTimer)
      window.removeEventListener('focus', onFocus)
      unbind()
      input.remove()
      resolve(file)
    })
    const onFocus = () => {
      focusTimer = window.setTimeout(() => {
        if (!settled && !input.files?.length) {
          settled = true
          window.clearTimeout(armTimer)
          window.removeEventListener('focus', onFocus)
          unbind()
          input.value = ''
          input.remove()
          resolve(null)
        }
      }, 700)
    }
    document.body.appendChild(input)
    input.click()
    const armTimer = window.setTimeout(() => {
      window.addEventListener('focus', onFocus, { once: true })
    }, 400)
  })
}
