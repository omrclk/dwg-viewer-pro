import type { DrawingEntity } from './drawingTypes'

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

export const VIEW_BOX = { width: 390, height: 760 }

export type DxfTransform = {
  bounds: Bounds
  scale: number
  offsetX: number
  offsetY: number
  viewWidth: number
  viewHeight: number
}

export function boundsForEntities(entities: DrawingEntity[]): Bounds {
  const xs: number[] = []
  const ys: number[] = []

  entities.forEach((entity) => {
    if (entity.type === 'line') {
      xs.push(entity.x1, entity.x2)
      ys.push(entity.y1, entity.y2)
    }

    if (entity.type === 'circle' || entity.type === 'arc') {
      xs.push(entity.cx - entity.r, entity.cx + entity.r)
      ys.push(entity.cy - entity.r, entity.cy + entity.r)
    }

    if (entity.type === 'polyline' || entity.type === 'solid') {
      entity.points.forEach((point) => {
        xs.push(point.x)
        ys.push(point.y)
      })
    }

    if (entity.type === 'text') {
      xs.push(entity.x, entity.x + Math.max(entity.height, entity.text.length * entity.height * 0.6))
      ys.push(entity.y, entity.y + entity.height)
    }
  })

  if (!xs.length || !ys.length) {
    return { minX: 0, minY: 0, maxX: 390, maxY: 760 }
  }

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

export function buildDxfTransform(bounds: Bounds, viewWidth = VIEW_BOX.width, viewHeight = VIEW_BOX.height): DxfTransform {
  const pad = Math.max(16, Math.min(viewWidth, viewHeight) * 0.06)
  const width = Math.max(1e-6, bounds.maxX - bounds.minX)
  const height = Math.max(1e-6, bounds.maxY - bounds.minY)
  const scale = Math.min((viewWidth - pad * 2) / width, (viewHeight - pad * 2) / height)
  const offsetX = pad + (viewWidth - pad * 2 - width * scale) / 2
  const offsetY = pad + (viewHeight - pad * 2 - height * scale) / 2

  return { bounds, scale, offsetX, offsetY, viewWidth, viewHeight }
}

export function viewBoxToWorld(
  viewX: number,
  viewY: number,
  transform: DxfTransform,
) {
  return {
    x: transform.bounds.minX + (viewX - transform.offsetX) / transform.scale,
    y: transform.bounds.maxY - (viewY - transform.offsetY) / transform.scale,
  }
}

export function worldToViewBox(
  point: { x: number; y: number },
  transform: DxfTransform,
) {
  return {
    x: transform.offsetX + (point.x - transform.bounds.minX) * transform.scale,
    y: transform.offsetY + (transform.bounds.maxY - point.y) * transform.scale,
  }
}
