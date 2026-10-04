import type { Point2 } from '../drawingTypes'

export function tessellateBulge(start: Point2, end: Point2, bulge: number, segments = 8): Point2[] {
  if (!Number.isFinite(bulge) || Math.abs(bulge) < 1e-8) return [start]
  const dx = end.x - start.x
  const dy = end.y - start.y
  const chord = Math.hypot(dx, dy)
  if (chord < 1e-9) return [start]

  const theta = 4 * Math.atan(bulge)
  const radius = chord / (2 * Math.sin(theta / 2))
  const midX = (start.x + end.x) / 2
  const midY = (start.y + end.y) / 2
  const offset = Math.sqrt(Math.max(0, radius * radius - (chord / 2) * (chord / 2)))
  const nx = -dy / chord
  const ny = dx / chord
  // Positive bulge is counterclockwise, which places a minor arc to the right of the directed chord.
  const direction = bulge > 0 ? 1 : -1
  const center = { x: midX + direction * nx * offset, y: midY + direction * ny * offset }
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x)
  const steps = Math.max(2, Math.ceil(Math.abs(theta) / (Math.PI / Math.max(4, segments))))
  const points: Point2[] = []
  for (let index = 0; index < steps; index += 1) {
    const angle = startAngle + (theta * index) / steps
    points.push({
      x: center.x + Math.abs(radius) * Math.cos(angle),
      y: center.y + Math.abs(radius) * Math.sin(angle),
    })
  }
  return points
}

export function tessellatePolyline(points: Point2[], bulges: number[] | undefined, closed: boolean): Point2[] {
  if (points.length < 2) return points.slice()
  const result: Point2[] = []
  const count = closed ? points.length : points.length - 1
  for (let index = 0; index < count; index += 1) {
    const start = points[index]
    const end = points[(index + 1) % points.length]
    const bulge = bulges?.[index] ?? 0
    const sampled = tessellateBulge(start, end, bulge)
    result.push(...sampled)
  }
  if (!closed) result.push(points[points.length - 1])
  return result
}

export function sampleArc(cx: number, cy: number, radius: number, startDeg: number, endDeg: number, steps = 24): Point2[] {
  let sweep = endDeg - startDeg
  while (sweep <= 0) sweep += 360
  while (sweep > 360) sweep -= 360
  const count = Math.max(2, Math.ceil((Math.abs(sweep) / 360) * steps))
  const points: Point2[] = []
  for (let index = 0; index <= count; index += 1) {
    const angle = ((startDeg + (sweep * index) / count) * Math.PI) / 180
    points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
  }
  return points
}

export function sampleEllipse(
  cx: number,
  cy: number,
  majorX: number,
  majorY: number,
  ratio: number,
  startParam: number,
  endParam: number,
  steps = 32,
): Point2[] {
  const major = Math.hypot(majorX, majorY) || 1
  const ux = majorX / major
  const uy = majorY / major
  const vx = -uy
  const vy = ux
  const minor = major * (Number.isFinite(ratio) && ratio > 0 ? ratio : 1)
  let sweep = endParam - startParam
  if (sweep <= 1e-6) sweep += Math.PI * 2
  const count = Math.max(8, steps)
  const points: Point2[] = []
  for (let index = 0; index <= count; index += 1) {
    const angle = startParam + (sweep * index) / count
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    points.push({
      x: cx + major * cos * ux + minor * sin * vx,
      y: cy + major * cos * uy + minor * sin * vy,
    })
  }
  return points
}

export function plainMText(value: string) {
  return value
    .replace(/\\P/g, '\n')
    .replace(/\\~/g, ' ')
    .replace(/\\\{|\\\}/g, '')
    .replace(/\{[^;]*;/g, '')
    .replace(/\}/g, '')
    .replace(/%%[dD]/g, '°')
    .replace(/%%[pP]/g, '±')
    .replace(/%%[cC]/g, 'Ø')
    .trim()
}

const ACI_BASIC = ['#000000', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffffff', '#808080', '#c0c0c0']

export function aciColor(index: number, theme: 'dark' | 'light' = 'dark') {
  const normalized = ((Math.trunc(index) % 256) + 256) % 256
  if (normalized === 7) return theme === 'light' ? '#1a1a1a' : '#ffffff'
  if (normalized === 0) return theme === 'light' ? '#1a1a1a' : '#e8e8e8'
  if (normalized < ACI_BASIC.length) return ACI_BASIC[normalized]
  const hue = ((normalized - 10) * 15) % 360
  const light = 42 + ((normalized % 5) * 8)
  return `hsl(${hue} ${70}% ${light}%)`
}

export function rgbCss(r: number, g: number, b: number) {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`
}

export function dashForLineType(name: string | undefined | null): number[] | undefined {
  if (!name) return undefined
  const upper = name.toUpperCase()
  if (upper.includes('BYLAYER') || upper.includes('BYBLOCK') || upper.includes('CONTINUOUS')) return undefined
  if (upper.includes('DASHDOT')) return [14, 4, 2, 4]
  if (upper.includes('CENTER') || upper.includes('PHANTOM')) return [18, 4, 3, 4]
  if (upper.includes('DOT')) return [1.5, 4]
  if (upper.includes('DASH') || upper.includes('HIDDEN')) return [12, 5]
  return undefined
}
