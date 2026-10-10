import type { RecentFileEntry } from './fileTypes'
import { formatCadVersion } from './fileListFormat'
import { loadCachedFile, loadThumbnail, saveThumbnail, updateRecentFile } from './recentFiles'
import { renderDrawingThumbnail } from './fileThumb'

function primaryEntities(document: { layouts: Array<{ isModel: boolean; entities: import('./drawingTypes').DrawingEntity[] }> }) {
  const model = document.layouts.find((item) => item.isModel && item.entities.length)
  const layout = model ?? [...document.layouts].sort((a, b) => b.entities.length - a.entities.length)[0]
  return layout?.entities ?? []
}

export async function ensureRecentThumbnail(entry: RecentFileEntry) {
  const cached = await loadThumbnail(entry.id)
  if (cached) return cached
  if (entry.format !== 'dwg' && entry.format !== 'dxf') return null
  const file = await loadCachedFile(entry.id)
  if (!file) return null
  const { readDrawingBytes } = await import('./cad/readDrawing')
  const document = await readDrawingBytes(new Uint8Array(await file.arrayBuffer()), entry.format)
  const thumb = await renderDrawingThumbnail(primaryEntities(document))
  if (thumb) await saveThumbnail(entry.id, thumb)
  if (!entry.versionLabel) updateRecentFile(entry.id, { versionLabel: formatCadVersion(document.version, entry.format) })
  return thumb
}

const sampleMemory = new Map<string, string>()

export async function loadSampleThumbnail(format: 'dwg' | 'dxf') {
  const id = `sample-${format}`
  const memory = sampleMemory.get(id)
  if (memory) return memory
  const stored = await loadThumbnail(id)
  if (stored) {
    sampleMemory.set(id, stored)
    return stored
  }
  const response = await fetch(`samples/ornek-plan.${format}`)
  if (!response.ok) return null
  const bytes = new Uint8Array(await response.arrayBuffer())
  const { readDrawingBytes } = await import('./cad/readDrawing')
  const document = await readDrawingBytes(bytes, format)
  const thumb = await renderDrawingThumbnail(primaryEntities(document))
  if (thumb) {
    sampleMemory.set(id, thumb)
    await saveThumbnail(id, thumb)
  }
  return thumb
}
