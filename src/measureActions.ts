import type { MeasureKind, MeasureRecord, Point2 } from './measureMath'
import {
  angleAtVertex,
  applyScale,
  arcLengthFromThreePoints,
  distance,
  formatAngle,
  formatArea,
  formatCoord,
  formatLength,
  polygonArea,
} from './measureMath'

export function createMeasureId() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function requiredPointCount(mode: MeasureKind) {
  if (mode === 'distance' || mode === 'calibration') return 2
  if (mode === 'point') return 1
  if (mode === 'angle' || mode === 'arc') return 3
  return 3
}

export function canFinalize(mode: MeasureKind, points: Point2[]) {
  if (mode === 'area') return points.length >= 3
  return points.length >= requiredPointCount(mode)
}

export function buildMeasureRecord(
  kind: MeasureKind,
  points: Point2[],
  unitsPerDrawingUnit: number,
  unitLabel: string,
  options?: { label?: string; decimals?: number },
): MeasureRecord | null {
  const decimals = options?.decimals ?? 3
  const scaled = (value: number) => applyScale(value, unitsPerDrawingUnit)
  const stamp = new Date().toLocaleString('tr-TR')

  if (kind === 'distance' && points.length >= 2) {
    const raw = distance(points[0], points[1])
    const value = scaled(raw)
    return {
      id: createMeasureId(),
      kind,
      label: options?.label ?? 'Mesafe',
      value,
      displayValue: formatLength(value, unitLabel, decimals),
      unit: unitLabel,
      points: points.slice(0, 2),
      createdAt: stamp,
    }
  }

  if (kind === 'area' && points.length >= 3) {
    const raw = polygonArea(points)
    const value = raw * unitsPerDrawingUnit * unitsPerDrawingUnit
    return {
      id: createMeasureId(),
      kind,
      label: 'Alan',
      value,
      displayValue: formatArea(value, unitLabel, decimals),
      unit: `${unitLabel}\u00B2`,
      points: [...points],
      createdAt: stamp,
    }
  }

  if (kind === 'angle' && points.length >= 3) {
    const value = angleAtVertex(points[0], points[1], points[2])
    return {
      id: createMeasureId(),
      kind,
      label: 'Aci',
      value,
      displayValue: formatAngle(value, decimals),
      unit: '\u00B0',
      points: points.slice(0, 3),
      createdAt: stamp,
    }
  }

  if (kind === 'arc' && points.length >= 3) {
    const raw = arcLengthFromThreePoints(points[0], points[1], points[2])
    const value = scaled(raw)
    return {
      id: createMeasureId(),
      kind,
      label: 'Yay uzunlugu',
      value,
      displayValue: formatLength(value, unitLabel, decimals),
      unit: unitLabel,
      points: points.slice(0, 3),
      createdAt: stamp,
    }
  }

  if (kind === 'point' && points.length >= 1) {
    const point = points[0]
    const display = formatCoord(
      { x: applyScale(point.x, unitsPerDrawingUnit), y: applyScale(point.y, unitsPerDrawingUnit) },
      unitLabel,
    )
    return {
      id: createMeasureId(),
      kind,
      label: 'Koordinat',
      value: 0,
      displayValue: display,
      unit: unitLabel,
      points: [point],
      createdAt: stamp,
    }
  }

  return null
}

export function calibrationFactor(drawingDistance: number, realDistance: number) {
  if (!drawingDistance) return 1
  return realDistance / drawingDistance
}
