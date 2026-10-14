import type { DrawingEntity, TextRun } from '../drawingTypes'

/** Letters taller than this share of the drawing's short side are not real text height. */
const HARD_RATIO = 0.22
const TARGET_RATIO = 0.035
const MIN_RATIO = 0.004
const ANNOTATION_SCALES = [2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]

type Point = { x: number; y: number }

function pointsOf(entity: DrawingEntity): Point[] {
  if (entity.type === 'line') return [{ x: entity.x1, y: entity.y1 }, { x: entity.x2, y: entity.y2 }]
  if (entity.type === 'circle' || entity.type === 'arc') {
    return [
      { x: entity.cx - entity.r, y: entity.cy - entity.r },
      { x: entity.cx + entity.r, y: entity.cy + entity.r },
    ]
  }
  if (entity.type === 'polyline' || entity.type === 'solid') return entity.points
  return []
}

function percentile(sorted: number[], ratio: number) {
  if (!sorted.length) return 0
  const index = (sorted.length - 1) * ratio
  const low = Math.floor(index)
  const high = Math.ceil(index)
  if (low === high) return sorted[low]
  return sorted[low] * (high - index) + sorted[high] * (index - low)
}

function robustSpan(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const low = percentile(sorted, 0.1)
  const high = percentile(sorted, 0.9)
  const core = Math.max(high - low, 1e-9)
  const full = sorted[sorted.length - 1] - sorted[0]
  if (full > core * 8) return Math.max(high - low, 0)
  return Math.max(full, 0)
}

/** Short side of the real geometry. Zero when the layout has no drawable curves. */
export function geometryMinor(entities: DrawingEntity[]) {
  const xs: number[] = []
  const ys: number[] = []
  entities.forEach((entity) => {
    if (entity.type === 'text') return
    pointsOf(entity).forEach((point) => {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return
      if (Math.abs(point.x) > 1e12 || Math.abs(point.y) > 1e12) return
      xs.push(point.x)
      ys.push(point.y)
    })
  })
  if (xs.length < 2) return 0
  const width = robustSpan(xs)
  const height = robustSpan(ys)
  // A single line has no area. Text beside it is not "larger than the drawing".
  if (width < 1e-3 || height < 1e-3) return 0
  return Math.min(width, height)
}

/**
 * Width factor is a glyph scale, not a percentage. Values from 10 to 100 are
 * treated as a percent (80 → 0.8). Larger values are ignored.
 */
export function clampWidthFactor(value: number | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) return 1
  if (value > 10 && value <= 100) return value / 100
  if (value > 100) return 1
  return value
}

/** Bring an absurd text height back in line with the drawing. Annotative text snaps to a standard scale. */
export function capTextHeight(height: number, minor: number, annotative: boolean) {
  if (!(height > 0) || !(minor > 0)) return height
  const hard = minor * HARD_RATIO
  if (height <= hard) return height
  if (!annotative) return hard
  const target = Math.max(minor * TARGET_RATIO, 1e-6)
  let best = hard
  let bestScore = Math.abs(Math.log(hard / target))
  ANNOTATION_SCALES.forEach((scale) => {
    const next = height / scale
    if (next > hard || next < minor * MIN_RATIO) return
    const score = Math.abs(Math.log(next / target))
    if (score < bestScore) {
      best = next
      bestScore = score
    }
  })
  return best
}

function capRuns(lines: TextRun[][] | undefined, factor: number, limit: number) {
  if (!lines) return undefined
  return lines.map((line) => line.map((run) => {
    if (!(run.absoluteHeight && run.absoluteHeight > 0)) return run
    return { ...run, absoluteHeight: Math.min(run.absoluteHeight * factor, limit) }
  }))
}

/** Clamp text that would paint over the whole drawing. Text-only layouts are left alone. */
export function fitTextEntities(entities: DrawingEntity[]): DrawingEntity[] {
  const minor = geometryMinor(entities)
  return entities.map((entity) => {
    if (entity.type !== 'text') return entity
    const widthFactor = clampWidthFactor(entity.widthFactor)
    if (!(minor > 0)) return widthFactor === entity.widthFactor ? entity : { ...entity, widthFactor }
    const limit = minor * HARD_RATIO
    const height = capTextHeight(entity.height, minor, entity.annotative === true)
    const factor = entity.height > 0 ? height / entity.height : 1
    const lines = capRuns(entity.lines, factor, limit)
    return { ...entity, height, widthFactor, ...(lines ? { lines } : {}) }
  })
}
