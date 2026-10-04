import type { DrawingEntity } from './drawingTypes'
import type { Point2 } from './measureMath'
import { distance } from './measureMath'
import type { SnapKind, SnapSettings } from './settings'

export type SnapTarget = {
  point: Point2
  kind: SnapKind
}

function pushUnique(targets: SnapTarget[], point: Point2, kind: SnapKind) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return
  targets.push({ point, kind })
}

function lineIntersection(a1: Point2, a2: Point2, b1: Point2, b2: Point2): Point2 | null {
  const denominator = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x)
  if (Math.abs(denominator) < 1e-9) return null

  const detA = a1.x * a2.y - a1.y * a2.x
  const detB = b1.x * b2.y - b1.y * b2.x
  const x = (detA * (b1.x - b2.x) - (a1.x - a2.x) * detB) / denominator
  const y = (detA * (b1.y - b2.y) - (a1.y - a2.y) * detB) / denominator

  const onSegment = (p: Point2, s1: Point2, s2: Point2) => {
    const minX = Math.min(s1.x, s2.x) - 0.001
    const maxX = Math.max(s1.x, s2.x) + 0.001
    const minY = Math.min(s1.y, s2.y) - 0.001
    const maxY = Math.max(s1.y, s2.y) + 0.001
    return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
  }

  const point = { x, y }
  if (onSegment(point, a1, a2) && onSegment(point, b1, b2)) return point
  return null
}

export function collectSnapTargets(entities: DrawingEntity[], settings: SnapSettings, extraPoints: Point2[] = []) {
  const targets: SnapTarget[] = []
  const segments: Array<[Point2, Point2]> = []

  if (settings.endpoint || settings.midpoint || settings.intersection) {
    extraPoints.forEach((point) => {
      if (settings.endpoint) pushUnique(targets, point, 'endpoint')
    })
  }

  entities.forEach((entity) => {
    if (entity.type === 'line') {
      const p1 = { x: entity.x1, y: entity.y1 }
      const p2 = { x: entity.x2, y: entity.y2 }
      segments.push([p1, p2])
      if (settings.endpoint) {
        pushUnique(targets, p1, 'endpoint')
        pushUnique(targets, p2, 'endpoint')
      }
      if (settings.midpoint) pushUnique(targets, { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }, 'midpoint')
    }

    if (entity.type === 'circle' || entity.type === 'arc') {
      if (settings.center) pushUnique(targets, { x: entity.cx, y: entity.cy }, 'center')
    }

    if (entity.type === 'arc' && settings.endpoint) {
      const start = (entity.start * Math.PI) / 180
      const end = (entity.end * Math.PI) / 180
      pushUnique(targets, { x: entity.cx + entity.r * Math.cos(start), y: entity.cy + entity.r * Math.sin(start) }, 'endpoint')
      pushUnique(targets, { x: entity.cx + entity.r * Math.cos(end), y: entity.cy + entity.r * Math.sin(end) }, 'endpoint')
    }

    if (entity.type === 'polyline') {
      entity.points.forEach((point, index) => {
        if (settings.endpoint) pushUnique(targets, point, 'endpoint')
        const next = entity.points[index + 1]
        if (next) {
          segments.push([point, next])
          if (settings.midpoint) {
            pushUnique(targets, { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }, 'midpoint')
          }
        }
        if (entity.closed && index === entity.points.length - 1 && entity.points.length > 2) {
          const first = entity.points[0]
          segments.push([point, first])
          if (settings.midpoint) {
            pushUnique(targets, { x: (point.x + first.x) / 2, y: (point.y + first.y) / 2 }, 'midpoint')
          }
        }
      })
    }
  })

  if (settings.intersection) {
    const maxChecks = 80
    let checks = 0
    for (let i = 0; i < segments.length && checks < maxChecks; i += 1) {
      for (let j = i + 1; j < segments.length && checks < maxChecks; j += 1) {
        checks += 1
        const hit = lineIntersection(segments[i][0], segments[i][1], segments[j][0], segments[j][1])
        if (hit) pushUnique(targets, hit, 'intersection')
      }
    }
  }

  return targets
}

export function snapToleranceInCoords(
  viewportScale: number,
  contentHeight: number,
  viewBoxHeight: number,
  touchRadiusPx = 32,
) {
  const viewUnitsPerPx = viewBoxHeight / (contentHeight * viewportScale || 1)
  return touchRadiusPx * viewUnitsPerPx
}

export function findNearestSnap(cursor: Point2, targets: SnapTarget[], tolerance: number, settings: SnapSettings) {
  if (!settings.enabled || !targets.length) return null

  let best: SnapTarget | null = null
  let bestDistance = tolerance

  targets.forEach((target) => {
    if (!settings[target.kind]) return
    const dist = distance(cursor, target.point)
    if (dist <= bestDistance) {
      best = target
      bestDistance = dist
    }
  })

  return best
}

export function snapKindLabel(kind: SnapKind) {
  if (kind === 'endpoint') return 'Uç nokta'
  if (kind === 'midpoint') return 'Orta nokta'
  if (kind === 'center') return 'Merkez'
  return 'Kesisim'
}
