import { describe, expect, it } from 'vitest'
import {
  angleAtVertex,
  applyScale,
  arcLengthFromThreePoints,
  distance,
  formatAngle,
  formatArea,
  formatLength,
  polygonArea,
  recordsToCsv,
} from './measureMath'

describe('measureMath', () => {
  it('calculates distance between two points', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('calculates polygon area', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    expect(polygonArea(square)).toBe(100)
  })

  it('calculates angle at vertex', () => {
    const angle = angleAtVertex({ x: 10, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 })
    expect(angle).toBeCloseTo(90, 1)
  })

  it('calculates arc length from three points', () => {
    const center = { x: 0, y: 0 }
    const start = { x: 10, y: 0 }
    const end = { x: 0, y: 10 }
    const length = arcLengthFromThreePoints(center, start, end)
    expect(length).toBeGreaterThan(15)
    expect(length).toBeLessThan(16)
  })

  it('applies scale factor', () => {
    expect(applyScale(100, 0.01)).toBeCloseTo(1)
  })

  it('formats values', () => {
    expect(formatLength(1.2345, 'm')).toBe('1.234 m')
    expect(formatArea(2, 'm')).toBe('2.000 m²')
    expect(formatAngle(45)).toBe('45.00°')
  })

  it('exports records to csv', () => {
    const csv = recordsToCsv([
      {
        id: 'm-1',
        kind: 'distance',
        label: 'Mesafe',
        value: 5,
        displayValue: '5.000 m',
        unit: 'm',
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
        ],
        createdAt: '2026-01-01',
      },
    ])
    expect(csv).toContain('m-1')
    expect(csv).toContain('Mesafe')
  })
})
