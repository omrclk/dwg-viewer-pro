import type { FileSource, SupportedFormat } from './fileTypes'
import { sourceLabel } from './fileTypes'

const DWG_VERSIONS: Record<string, string> = {
  AC1009: 'AutoCAD R12',
  AC1012: 'AutoCAD R13',
  AC1014: 'AutoCAD R14',
  AC1015: 'AutoCAD 2000',
  AC1018: 'AutoCAD 2004',
  AC1021: 'AutoCAD 2007',
  AC1024: 'AutoCAD 2010',
  AC1027: 'AutoCAD 2013',
  AC1032: 'AutoCAD 2018',
}

export function formatTurkishDateTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day}.${month}.${date.getFullYear()} ${hours}:${minutes}`
}

/** Keep the extension visible when the name is too long for two compact lines. */
export function fileTitle(name: string, max = 64) {
  const trimmed = name.trim()
  if (trimmed.length <= max) return { text: trimmed, ext: '' }
  const dot = trimmed.lastIndexOf('.')
  const ext = dot > 0 && trimmed.length - dot <= 8 ? trimmed.slice(dot) : ''
  const base = ext ? trimmed.slice(0, dot) : trimmed
  const room = Math.max(8, max - ext.length - 1)
  const head = Math.ceil(room * 0.62)
  const tail = Math.max(1, room - head)
  return { text: `${base.slice(0, head)}…${base.slice(-tail)}`, ext }
}

export function formatCadVersion(version: string | undefined, format: SupportedFormat) {
  const raw = (version ?? '').trim()
  if (DWG_VERSIONS[raw]) return DWG_VERSIONS[raw]
  if (/^\d{4}$/.test(raw) || /^R\d+/.test(raw)) return `AutoCAD ${raw}`
  if (raw.startsWith('AutoCAD')) return raw
  if (format === 'dxf') return raw && raw !== 'DXF' ? `AutoCAD ${raw}` : 'DXF'
  if (format === 'pdf') return 'PDF'
  if (format === 'dwf') return 'DWF'
  return raw || format.toUpperCase()
}

export function sniffDrawingVersion(bytes: Uint8Array, format: SupportedFormat) {
  const head = String.fromCharCode(...bytes.slice(0, 6))
  if (DWG_VERSIONS[head]) return DWG_VERSIONS[head]
  if (format === 'dxf') {
    const text = new TextDecoder().decode(bytes.slice(0, 8000))
    const match = text.match(/AC1\d{3}/)
    if (match && DWG_VERSIONS[match[0]]) return DWG_VERSIONS[match[0]]
    return 'DXF'
  }
  return formatCadVersion(undefined, format)
}

export function originLabel(source: FileSource, sourcePath?: string, explicit?: string) {
  if (explicit?.trim()) return explicit.trim()
  const path = (sourcePath ?? '').toLocaleLowerCase('tr')
  if (path.includes('whatsapp')) return 'WhatsApp'
  if (path.includes('bip')) return 'BiP'
  if (path.includes('telegram')) return 'Telegram'
  if (path.includes('örnek') || path.includes('ornek')) return 'Örnekler'
  if (source === 'google-drive' || path.includes('google drive')) return 'Google Drive'
  if (source === 'onedrive' || path.includes('onedrive')) return 'OneDrive'
  if (source === 'dropbox' || path.includes('dropbox')) return 'Dropbox'
  if (path.includes('sistem')) return 'Sistem seçici'
  return sourceLabel(source)
}
