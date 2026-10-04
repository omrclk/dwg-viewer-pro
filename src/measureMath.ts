export type Point2 = { x: number; y: number }

export type MeasureKind = 'distance' | 'area' | 'angle' | 'arc' | 'point' | 'calibration'

export type MeasureRecord = {
  id: string
  kind: MeasureKind
  label: string
  value: number
  displayValue: string
  unit: string
  points: Point2[]
  createdAt: string
}

export function distance(a: Point2, b: Point2) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function polygonArea(points: Point2[]) {
  if (points.length < 3) return 0
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    sum += current.x * next.y - next.x * current.y
  }
  return Math.abs(sum) / 2
}

export function angleAtVertex(a: Point2, vertex: Point2, c: Point2) {
  const v1x = a.x - vertex.x
  const v1y = a.y - vertex.y
  const v2x = c.x - vertex.x
  const v2y = c.y - vertex.y
  const dot = v1x * v2x + v1y * v2y
  const mag = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y)
  if (!mag) return 0
  const radians = Math.acos(Math.min(1, Math.max(-1, dot / mag)))
  return (radians * 180) / Math.PI
}

export function arcLengthFromThreePoints(center: Point2, start: Point2, end: Point2) {
  const radius = distance(center, start)
  if (!radius) return 0
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x)
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x)
  let sweep = endAngle - startAngle
  if (sweep <= 0) sweep += Math.PI * 2
  return radius * sweep
}

export function formatCoord(point: Point2, unit: string) {
  return `X ${point.x.toFixed(3)}  Y ${point.y.toFixed(3)} ${unit}`
}

export function applyScale(rawValue: number, unitsPerDrawingUnit: number) {
  return rawValue * unitsPerDrawingUnit
}

export function formatLength(value: number, unit: string, decimals = 3) {
  return `${value.toFixed(decimals)} ${unit}`
}

export function formatArea(value: number, unit: string, decimals = 3) {
  return `${value.toFixed(decimals)} ${unit}\u00B2`
}

export function formatAngle(value: number, decimals = 2) {
  return `${value.toFixed(decimals)}\u00B0`
}

export function recordsToCsv(records: MeasureRecord[]) {
  const header = ['id', 'kind', 'label', 'value', 'displayValue', 'unit', 'points', 'createdAt']
  const rows = records.map((record) => [
    record.id,
    record.kind,
    record.label,
    String(record.value),
    record.displayValue,
    record.unit,
    JSON.stringify(record.points),
    record.createdAt,
  ])
  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
