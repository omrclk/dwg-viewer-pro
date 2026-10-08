import { distanceToSketch } from './editTools'
import type { SketchShape } from './drawTools'
import { distance, type MeasureRecord, type Point2 } from './measureMath'
import type { TextNote } from './markupTools'

export type MarkupHit = { kind: 'sketch' | 'measure' | 'note'; id: string }

export function nearestMarkup(
  point: Point2,
  tolerance: number,
  sketches: SketchShape[],
  measures: Pick<MeasureRecord, 'id' | 'points'>[],
  notes: Pick<TextNote, 'id' | 'point'>[],
): MarkupHit | null {
  let best: { hit: MarkupHit; dist: number } | null = null
  const consider = (hit: MarkupHit, dist: number) => {
    if (dist > tolerance) return
    if (!best || dist < best.dist) best = { hit, dist }
  }
  sketches.forEach((shape) => consider({ kind: 'sketch', id: shape.id }, distanceToSketch(shape, point)))
  measures.forEach((record) => {
    const dist = record.points.length ? Math.min(...record.points.map((item) => distance(item, point))) : Number.POSITIVE_INFINITY
    consider({ kind: 'measure', id: record.id }, dist)
  })
  notes.forEach((note) => consider({ kind: 'note', id: note.id }, distance(note.point, point)))
  return best?.hit ?? null
}

export function translatePoint(point: Point2, dx: number, dy: number): Point2 {
  return { x: point.x + dx, y: point.y + dy }
}
