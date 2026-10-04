import type { DrawingEntity } from './drawingTypes'

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

export const VIEW_BOX = { width: 390, height: 760 }

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

    if (entity.type === 'polyline') {
      entity.points.forEach((point) => {
        xs.push(point.x)
        ys.push(point.y)
      })
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

export function buildDxfTransform(bounds: Bounds) {
  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  const scale = Math.min(330 / width, 640 / height)
  const offsetX = 30 + (330 - width * scale) / 2
  const offsetY = 60 + (640 - height * scale) / 2

  return { bounds, scale, offsetX, offsetY }
}

export function viewBoxToWorld(
  viewX: number,
  viewY: number,
  transform: ReturnType<typeof buildDxfTransform>,
) {
  return {
    x: transform.bounds.minX + (viewX - transform.offsetX) / transform.scale,
    y: transform.bounds.maxY - (viewY - transform.offsetY) / transform.scale,
  }
}

export function worldToViewBox(
  point: { x: number; y: number },
  transform: ReturnType<typeof buildDxfTransform>,
) {
  return {
    x: transform.offsetX + (point.x - transform.bounds.minX) * transform.scale,
    y: transform.offsetY + (transform.bounds.maxY - point.y) * transform.scale,
  }
}
