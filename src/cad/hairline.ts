/** Device pixel ratio used for the viewport-sized backing store. Phones at 2.6–3.5 stay 1:1; 4 is the memory cap. */
export function readDevicePixelRatio() {
  if (typeof window === 'undefined') return 1
  const ratio = window.devicePixelRatio || 1
  if (!Number.isFinite(ratio) || ratio < 1) return 1
  return Math.min(4, ratio)
}

export function hairlineCss(dpr: number) {
  const ratio = Number.isFinite(dpr) && dpr >= 1 ? dpr : 1
  return 1 / ratio
}

/**
 * Hairline is one device pixel. Real lineweight is world width times pixels-per-world-unit
 * with no minimum, so a thin polyline stays thin when zoomed out.
 */
export function resolveStrokeWidth(
  showLineweights: boolean,
  worldWidth: number | undefined,
  pixelsPerWorld: number,
  hairline: number,
) {
  if (!showLineweights || !worldWidth || worldWidth <= 0 || !Number.isFinite(worldWidth)) return hairline
  const px = worldWidth * pixelsPerWorld
  return px > 0 && Number.isFinite(px) ? px : hairline
}

/** Center of the device pixel that contains this CSS-pixel coordinate. */
export function snapDevice(value: number, dpr: number) {
  const ratio = Number.isFinite(dpr) && dpr >= 1 ? dpr : 1
  return (Math.round(value * ratio) + 0.5) / ratio
}

const SPAN_BIN = 4

/**
 * Keep one hairline per device-pixel row or column. A second line that lands on the same
 * pixels is dropped until a zoom puts it on its own pixel. Spans that only share an axis
 * but not the same x/y bins both draw.
 */
export function claimHairlineSpan(taken: Set<number>, axisCss: number, fromCss: number, toCss: number, dpr: number) {
  const ratio = Number.isFinite(dpr) && dpr >= 1 ? dpr : 1
  const row = Math.round(axisCss * ratio)
  let start = Math.round((Math.min(fromCss, toCss) * ratio) / SPAN_BIN)
  let end = Math.round((Math.max(fromCss, toCss) * ratio) / SPAN_BIN)
  if (end < start) {
    const swap = start
    start = end
    end = swap
  }
  if (end === start) end = start + 1
  const count = end - start + 1
  const step = Math.max(1, Math.floor(count / 8))
  let samples = 0
  let hits = 0
  for (let bin = start; bin <= end; bin += step) {
    samples += 1
    if (taken.has(row * 131072 + bin)) hits += 1
  }
  if (samples > 0 && hits / samples > 0.6) return false
  for (let bin = start; bin <= end; bin += 1) taken.add(row * 131072 + bin)
  return true
}

export function decimateScreenPoints<T extends { x: number; y: number }>(points: T[], minDist: number) {
  if (points.length <= 2 || !(minDist > 0)) return points
  const kept: T[] = [points[0]]
  const min2 = minDist * minDist
  for (let index = 1; index < points.length - 1; index += 1) {
    const last = kept[kept.length - 1]
    const dx = points[index].x - last.x
    const dy = points[index].y - last.y
    if (dx * dx + dy * dy >= min2) kept.push(points[index])
  }
  kept.push(points[points.length - 1])
  return kept
}
