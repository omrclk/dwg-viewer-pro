import type { DrawingEntity } from './drawingTypes'
import type { Point2 } from './measureMath'
import { distance } from './measureMath'

export type EntityHit = {
  entity: DrawingEntity
  layer: string
  kind: string
  distance: number
}

function pointToSegmentDistance(point: Point2, a: Point2, b: Point2) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (!lengthSq) return distance(point, a)

  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq))
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy })
}

export function findNearestEntity(point: Point2, entities: DrawingEntity[], tolerance: number): EntityHit | null {
  let best: EntityHit | null = null
  let bestDistance = tolerance

  entities.forEach((entity) => {
    if (entity.type === 'line') {
      const dist = pointToSegmentDistance(point, { x: entity.x1, y: entity.y1 }, { x: entity.x2, y: entity.y2 })
      if (dist < bestDistance) {
        bestDistance = dist
        best = { entity, layer: entity.layer, kind: 'Cizgi', distance: dist }
      }
    }

    if (entity.type === 'circle') {
      const center = { x: entity.cx, y: entity.cy }
      const dist = Math.abs(distance(point, center) - entity.r)
      if (dist < bestDistance) {
        bestDistance = dist
        best = { entity, layer: entity.layer, kind: 'Daire', distance: dist }
      }
    }

    if (entity.type === 'arc') {
      const center = { x: entity.cx, y: entity.cy }
      const dist = Math.abs(distance(point, center) - entity.r)
      if (dist < bestDistance) {
        bestDistance = dist
        best = { entity, layer: entity.layer, kind: 'Yay', distance: dist }
      }
    }

    if (entity.type === 'text') {
      const dist = distance(point, { x: entity.x, y: entity.y })
      if (dist < bestDistance) {
        bestDistance = dist
        best = { entity, layer: entity.layer, kind: 'Metin', distance: dist }
      }
    }

    if (entity.type === 'polyline' || entity.type === 'solid') {
      entity.points.forEach((start, index) => {
        const closed = entity.type === 'polyline' && entity.closed
        const end = entity.points[index + 1] ?? (closed ? entity.points[0] : null)
        if (!end) return
        const dist = pointToSegmentDistance(point, start, end)
        if (dist < bestDistance) {
          bestDistance = dist
          best = { entity, layer: entity.layer, kind: 'Polyline', distance: dist }
        }
      })
    }
  })

  return best
}
