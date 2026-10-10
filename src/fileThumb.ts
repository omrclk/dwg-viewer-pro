import type { DrawingEntity } from './drawingTypes'
import { renderScene } from './cad/renderScene'

const THUMB_W = 96
const THUMB_H = 72

export async function renderDrawingThumbnail(entities: DrawingEntity[]) {
  if (typeof document === 'undefined' || !entities.length) return null
  const canvas = document.createElement('canvas')
  canvas.width = THUMB_W * 2
  canvas.height = THUMB_H * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  renderScene(ctx, {
    entities,
    hiddenLayers: new Set(),
    width: canvas.width,
    height: canvas.height,
    viewWidth: THUMB_W,
    viewHeight: THUMB_H,
    theme: 'dark',
    showLineweights: false,
    dpr: 2,
  })
  return canvas.toDataURL('image/jpeg', 0.72)
}
