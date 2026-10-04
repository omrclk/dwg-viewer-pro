import { describe, expect, it } from 'vitest'
import { buildMeasureRecord, calibrationFactor, canFinalize, requiredPointCount } from './measureActions'

describe('measureActions', () => {
  it('returns required point counts', () => {
    expect(requiredPointCount('distance')).toBe(2)
    expect(requiredPointCount('point')).toBe(1)
    expect(requiredPointCount('angle')).toBe(3)
  })

  it('checks finalize readiness', () => {
    expect(canFinalize('distance', [{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(true)
    expect(canFinalize('area', [{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBe(false)
    expect(canFinalize('area', [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }])).toBe(true)
  })

  it('builds distance record', () => {
    const record = buildMeasureRecord(
      'distance',
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      0.01,
      'm',
    )
    expect(record?.kind).toBe('distance')
    expect(record?.value).toBeCloseTo(1)
  })

  it('builds area record', () => {
    const record = buildMeasureRecord(
      'area',
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      0.01,
      'm',
    )
    expect(record?.kind).toBe('area')
    expect(record?.value).toBeCloseTo(1)
  })

  it('calibrates scale factor', () => {
    expect(calibrationFactor(100, 2)).toBe(0.02)
    expect(calibrationFactor(0, 2)).toBe(1)
  })
})
