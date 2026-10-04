import type { DrawingEntity } from './drawingTypes'

export type SupportedFormat = 'dwg' | 'dxf' | 'dwf' | 'pdf'

export type FileSource = 'device' | 'google-drive' | 'onedrive' | 'dropbox'

export type OpenedFile = {
  name: string
  size: number
  format: SupportedFormat
  source: FileSource
  url?: string
  entities?: DrawingEntity[]
  message?: string
}

export type RecentFileEntry = {
  id: string
  name: string
  size: number
  format: SupportedFormat
  source: FileSource
  openedAt: string
  cached: boolean
}

export const SUPPORTED_EXTENSIONS = ['dwg', 'dxf', 'dwf', 'pdf'] as const

export const FILE_ACCEPT = '.dwg,.dxf,.dwf,.pdf,application/pdf,image/vnd.dwg,application/acad,application/x-acad'

export function getFormat(fileName: string): SupportedFormat | null {
  const extension = fileName.split('.').pop()?.toLowerCase()
  return SUPPORTED_EXTENSIONS.includes(extension as SupportedFormat) ? (extension as SupportedFormat) : null
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function sourceLabel(source: FileSource) {
  if (source === 'device') return 'Cihaz'
  if (source === 'google-drive') return 'Google Drive'
  if (source === 'onedrive') return 'OneDrive'
  return 'Dropbox'
}
