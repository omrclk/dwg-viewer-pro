import type { SketchShape } from './drawTools'
import { distance, type Point2 } from './measureMath'

export type EditTool = 'trim' | 'extend' | 'offset' | 'fillet' | 'chamfer'

export const EDIT_LABELS: Record<EditTool, string> = {
  trim: 'Kırp',
  extend: 'Uzat',
  offset: 'Ötele',
  fillet: 'Yuvarla',
  chamfer: 'Pah',
}

export const EDIT_HINTS: Record<EditTool, string> = {
  trim: 'Kırp: silmek için çizime dokunun',
  extend: 'Uzat: çizgi seçin, sonra hedef noktaya dokunun',
  offset: 'Ötele: şekli seçin, sonra yön için dokunun',
  fillet: 'Yuvarla: dikdörtgene dokunun',
  chamfer: 'Pah: dikdörtgene dokunun',
}

export function actionIdToEditTool(actionId: string): EditTool | null {
  const map: Record<string, EditTool> = {
    'edit-trim': 'trim',
    'edit-extend': 'extend',
    'edit-offset': 'offset',
    'edit-fillet': 'fillet',
    'edit-chamfer': 'chamfer',
  }
  return map[actionId] ?? null
}

export function distanceToSketch(shape: SketchShape, point: Point2) {
  if (shape.kind === 'line' && shape.points.length >= 2) {
    return pointToSegmentDistance(point, shape.points[0], shape.points[1])
  }
  if ((shape.kind === 'circle' || shape.kind === 'rect' || shape.kind === 'ellipse') && shape.points.length >= 2) {
    const mid = {
      x: (shape.points[0].x + shape.points[1].x) / 2,
      y: (shape.points[0].y + shape.points[1].y) / 2,
    }
    return distance(point, mid)
  }
  if (shape.points.length) {
    return Math.min(...shape.points.map((p) => distance(point, p)))
  }
  return Number.POSITIVE_INFINITY
}

function pointToSegmentDistance(point: Point2, a: Point2, b: Point2) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (!lengthSq) return distance(point, a)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq))
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy })
}

export function findNearestSketchShape(shapes: SketchShape[], point: Point2, tolerance: number) {
  let best: SketchShape | null = null
  let bestDistance = tolerance
  shapes.forEach((shape) => {
    const dist = distanceToSketch(shape, point)
    if (dist < bestDistance) {
      bestDistance = dist
      best = shape
    }
  })
  return best
}

export function trimSketchShape(shapes: SketchShape[], shapeId: string) {
  return shapes.filter((shape) => shape.id !== shapeId)
}

export function extendSketchShape(shape: SketchShape, target: Point2): SketchShape | null {
  if (shape.kind !== 'line' || shape.points.length < 2) return null
  const [start, end] = shape.points
  const startDist = distance(target, start)
  const endDist = distance(target, end)
  const nextEnd = endDist <= startDist ? start : end
  const fixed = nextEnd === start ? end : start
  return { ...shape, points: [fixed, target] }
}

export function offsetSketchShape(shape: SketchShape, target: Point2, amount = 12): SketchShape | null {
  if (shape.kind === 'line' && shape.points.length >= 2) {
    const [a, b] = shape.points
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const nx = (-dy / len) * amount
    const ny = (dx / len) * amount
    const sign = distance(target, { x: a.x + nx, y: a.y + ny }) < distance(target, a) ? 1 : -1
    return {
      ...shape,
      id: `${shape.id}-offset-${Date.now()}`,
      points: [
        { x: a.x + nx * sign, y: a.y + ny * sign },
        { x: b.x + nx * sign, y: b.y + ny * sign },
      ],
    }
  }

  if (shape.kind === 'rect' && shape.points.length >= 2) {
    const minX = Math.min(shape.points[0].x, shape.points[1].x)
    const minY = Math.min(shape.points[0].y, shape.points[1].y)
    const maxX = Math.max(shape.points[0].x, shape.points[1].x)
    const maxY = Math.max(shape.points[0].y, shape.points[1].y)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const sign = distance(target, { x: cx + amount, y: cy }) > distance(target, { x: cx, y: cy }) ? 1 : -1
    return {
      ...shape,
      id: `${shape.id}-offset-${Date.now()}`,
      points: [
        { x: minX - amount * sign, y: minY - amount * sign },
        { x: maxX + amount * sign, y: maxY + amount * sign },
      ],
    }
  }

  return null
}

export function filletSketchShape(shape: SketchShape, radius: number): SketchShape | null {
  if (shape.kind !== 'rect' || shape.points.length < 2 || radius <= 0) return null
  return { ...shape, cornerRadius: Math.min(radius, 40) }
}

export function chamferSketchShape(shape: SketchShape, size: number): SketchShape | null {
  if (shape.kind !== 'rect' || shape.points.length < 2 || size <= 0) return null
  return { ...shape, chamferSize: Math.min(size, 30) }
}
