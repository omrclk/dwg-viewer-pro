import { Capacitor } from '@capacitor/core'
import type { DrawingEntity } from './drawingTypes'
import { renderScene, type SceneTheme } from './cad/renderScene'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function renderDrawingBlob(
  entities: DrawingEntity[],
  hiddenLayers: Set<string>,
  theme: SceneTheme,
  watermark: string | null,
) {
  const viewWidth = 1600
  const viewHeight = 1100
  const canvas = document.createElement('canvas')
  canvas.width = viewWidth
  canvas.height = viewHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas olusturulamadi.')
  renderScene(ctx, { entities, hiddenLayers, width: viewWidth, height: viewHeight, viewWidth, viewHeight, theme })
  if (watermark) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.font = '600 28px sans-serif'
    ctx.fillStyle = theme === 'light' ? 'rgba(20,20,20,0.45)' : 'rgba(255,255,255,0.45)'
    ctx.textAlign = 'right'
    ctx.fillText(watermark, viewWidth - 28, viewHeight - 24)
  }
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('PNG olusturulamadi.'))), 'image/jpeg', 0.92)
  })
  return blob
}

function jpegPdf(jpeg: Uint8Array, width: number, height: number) {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (value: string | Uint8Array) => {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value
    chunks.push(bytes)
    length += bytes.length
  }
  const objectOffset = () => {
    offsets.push(length)
  }
  push('%PDF-1.4\n')
  objectOffset()
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  objectOffset()
  push('2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n')
  objectOffset()
  push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`)
  objectOffset()
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`)
  push(jpeg)
  push('\nendstream\nendobj\n')
  const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`
  objectOffset()
  push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`)
  const xref = length
  push(`xref\n0 6\n0000000000 65535 f \n`)
  offsets.forEach((offset) => push(`${String(offset).padStart(10, '0')} 00000 n \n`))
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`)
  const out = new Uint8Array(length)
  let cursor = 0
  chunks.forEach((chunk) => {
    out.set(chunk, cursor)
    cursor += chunk.length
  })
  return out
}

async function shareOrDownload(blob: Blob, filename: string, mime: string) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const raw = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    for (let index = 0; index < raw.length; index += 0x8000) {
      binary += String.fromCharCode(...raw.subarray(index, index + 0x8000))
    }
    const data = btoa(binary)
    const path = filename
    await Filesystem.writeFile({ path, data, directory: Directory.Cache })
    const uri = await Filesystem.getUri({ path, directory: Directory.Cache })
    await Share.share({ title: filename, url: uri.uri, dialogTitle: 'DWG Viewer Pro' })
    return
  }
  downloadBlob(new Blob([blob], { type: mime }), filename)
}

export async function exportDrawingPng(entities: DrawingEntity[], hiddenLayers: Set<string>, theme: SceneTheme, filename: string, watermark: string | null) {
  const blob = await renderDrawingBlob(entities, hiddenLayers, theme, watermark)
  await shareOrDownload(blob, filename.replace(/\.\w+$/, '') + '.jpg', 'image/jpeg')
}

export async function exportDrawingPdf(entities: DrawingEntity[], hiddenLayers: Set<string>, theme: SceneTheme, filename: string, watermark: string | null) {
  const blob = await renderDrawingBlob(entities, hiddenLayers, theme, watermark)
  const jpeg = new Uint8Array(await blob.arrayBuffer())
  const pdf = jpegPdf(jpeg, 1600, 1100)
  await shareOrDownload(new Blob([pdf], { type: 'application/pdf' }), filename.replace(/\.\w+$/, '') + '.pdf', 'application/pdf')
}
