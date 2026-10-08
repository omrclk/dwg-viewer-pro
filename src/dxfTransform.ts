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

export function isUsableBounds(bounds: Bounds | null | undefined): bounds is Bounds {
  if (!bounds) return false
  const { minX, minY, maxX, maxY } = bounds
  if (![minX, minY, maxX, maxY].every((value) => Number.isFinite(value))) return false
  if ([minX, minY, maxX, maxY].some((value) => Math.abs(value) > 1e19)) return false
  return maxX - minX > 1e-9 && maxY - minY > 1e-9
}

function geometryPoints(entities: DrawingEntity[]) {
  const points: Array<{ x: number; y: number }> = []
  entities.forEach((entity) => {
    if (entity.type === 'line') {
      points.push({ x: entity.x1, y: entity.y1 }, { x: entity.x2, y: entity.y2 })
    } else if (entity.type === 'circle' || entity.type === 'arc') {
      points.push(
        { x: entity.cx - entity.r, y: entity.cy - entity.r },
        { x: entity.cx + entity.r, y: entity.cy + entity.r },
      )
    } else if (entity.type === 'polyline' || entity.type === 'solid') {
      points.push(...entity.points)
    } else if (entity.type === 'text') {
      points.push({ x: entity.x, y: entity.y })
    }
  })
  return points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) < 1e12 && Math.abs(point.y) < 1e12)
}

function iqrFence(sorted: number[]) {
  const q1 = percentile(sorted, 0.25)
  const q3 = percentile(sorted, 0.75)
  const span = Math.max(q3 - q1, 1e-9)
  return { low: q1 - span * 8, high: q3 + span * 8 }
}

function percentile(sorted: number[], ratio: number) {
  if (!sorted.length) return 0
  const index = (sorted.length - 1) * ratio
  const low = Math.floor(index)
  const high = Math.ceil(index)
  if (low === high) return sorted[low]
  return sorted[low] * (high - index) + sorted[high] * (index - low)
}

function expandBounds(bounds: Bounds, fraction: number): Bounds {
  const padX = (bounds.maxX - bounds.minX) * fraction
  const padY = (bounds.maxY - bounds.minY) * fraction
  return {
    minX: bounds.minX - padX,
    minY: bounds.minY - padY,
    maxX: bounds.maxX + padX,
    maxY: bounds.maxY + padY,
  }
}

function containsBounds(outer: Bounds, inner: Bounds) {
  return outer.minX <= inner.minX && outer.maxX >= inner.maxX && outer.minY <= inner.minY && outer.maxY >= inner.maxY
}

export function boundsForEntities(entities: DrawingEntity[], hint?: Bounds | null): Bounds {
  const points = geometryPoints(entities)
  if (!points.length) {
    return isUsableBounds(hint) ? hint : { minX: 0, minY: 0, maxX: 390, maxY: 760 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  points.forEach((point) => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  })
  const full = { minX, minY, maxX, maxY }
  const xs = points.map((point) => point.x).sort((left, right) => left - right)
  const ys = points.map((point) => point.y).sort((left, right) => left - right)
  const xFence = iqrFence(xs)
  const yFence = iqrFence(ys)
  const kept = points.filter((point) => point.x >= xFence.low && point.x <= xFence.high && point.y >= yFence.low && point.y <= yFence.high)
  const fullWidth = Math.max(1e-9, full.maxX - full.minX)
  const fullHeight = Math.max(1e-9, full.maxY - full.minY)
  let box = full
  if (kept.length >= Math.max(3, points.length * 0.8) && kept.length < points.length) {
    const tight = kept.reduce(
      (acc, point) => ({
        minX: Math.min(acc.minX, point.x),
        minY: Math.min(acc.minY, point.y),
        maxX: Math.max(acc.maxX, point.x),
        maxY: Math.max(acc.maxY, point.y),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    )
    const tightWidth = Math.max(1e-9, tight.maxX - tight.minX)
    const tightHeight = Math.max(1e-9, tight.maxY - tight.minY)
    if (fullWidth > tightWidth * 8 || fullHeight > tightHeight * 8) box = expandBounds(tight, 0.03)
  }

  if (isUsableBounds(hint) && containsBounds(expandBounds(hint, 0.08), box)) {
    const hintWidth = hint.maxX - hint.minX
    const hintHeight = hint.maxY - hint.minY
    const boxWidth = Math.max(1e-9, box.maxX - box.minX)
    const boxHeight = Math.max(1e-9, box.maxY - box.minY)
    if (hintWidth < boxWidth * 8 && hintHeight < boxHeight * 8) box = hint
  }

  if (box.maxX - box.minX < 1e-6) box = { ...box, minX: box.minX - 1, maxX: box.maxX + 1 }
  if (box.maxY - box.minY < 1e-6) box = { ...box, minY: box.minY - 1, maxY: box.maxY + 1 }
  return box
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

/** Camera relative to the fit-to-screen transform. scale 1 and pan 0 is the fitted view. */
export type ViewCamera = { scale: number; panX: number; panY: number }

export function applyCamera(base: DxfTransform, camera: ViewCamera): DxfTransform {
  const scale = camera.scale > 0 && Number.isFinite(camera.scale) ? camera.scale : 1
  const panX = Number.isFinite(camera.panX) ? camera.panX : 0
  const panY = Number.isFinite(camera.panY) ? camera.panY : 0
  return {
    ...base,
    scale: base.scale * scale,
    offsetX: panX + scale * base.offsetX,
    offsetY: panY + scale * base.offsetY,
  }
}

/** CSS transform that carries a fitted bitmap from the committed camera to the live gesture. */
export function gestureDelta(committed: ViewCamera, gesture: ViewCamera): ViewCamera {
  const scale = committed.scale > 0 ? gesture.scale / committed.scale : 1
  return {
    scale,
    panX: gesture.panX - scale * committed.panX,
    panY: gesture.panY - scale * committed.panY,
  }
}
