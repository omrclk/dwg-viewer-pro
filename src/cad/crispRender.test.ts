import { describe, expect, it } from 'vitest'
import { applyCamera, buildDxfTransform, gestureDelta } from '../dxfTransform'
import { claimHairlineSpan, decimateScreenPoints, hairlineCss, resolveStrokeWidth, snapDevice } from './hairline'
import { buildSpatialIndex, querySpatialIndex } from './spatialIndex'
import { buildStressPlan, STRESS_PROBE } from './stressPlan'
import type { DrawingEntity } from '../drawingTypes'

describe('hairline strokes', () => {
  it('uses one device pixel unless lineweights are enabled', () => {
    const hairline = hairlineCss(3)
    expect(hairline).toBeCloseTo(1 / 3)
    expect(resolveStrokeWidth(false, 12, 4, hairline)).toBe(hairline)
    expect(resolveStrokeWidth(true, 0, 4, hairline)).toBe(hairline)
    expect(resolveStrokeWidth(true, 2, 0.01, hairline)).toBeCloseTo(0.02)
    expect(resolveStrokeWidth(true, 2, 0.01, hairline)).toBeLessThan(hairline)
  })

  it('snaps a coordinate onto a device-pixel center', () => {
    expect(snapDevice(10, 2)).toBe(10.25)
    expect(snapDevice(10.4, 2)).toBe(10.75)
  })

  it('drops a second hairline on the same device pixels and keeps a separated one', () => {
    const taken = new Set<number>()
    const dpr = 3
    expect(claimHairlineSpan(taken, 10, 0, 120, dpr)).toBe(true)
    expect(claimHairlineSpan(taken, 10 + 0.1 / dpr, 0, 120, dpr)).toBe(false)
    expect(claimHairlineSpan(taken, 10 + 1 / dpr, 0, 120, dpr)).toBe(true)
    expect(claimHairlineSpan(taken, 10, 400, 700, dpr)).toBe(true)
  })

  it('keeps polyline endpoints while dropping sub-pixel points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.2, y: 0 },
      { x: 0.4, y: 0 },
      { x: 3, y: 0 },
      { x: 3.1, y: 0 },
    ]
    const kept = decimateScreenPoints(points, 1)
    expect(kept[0]).toEqual(points[0])
    expect(kept[kept.length - 1]).toEqual(points[points.length - 1])
    expect(kept).toContainEqual(points[3])
    expect(kept.length).toBeLessThan(points.length)
  })
})

describe('camera and culling', () => {
  it('composes pan and zoom onto the fit transform', () => {
    const fit = buildDxfTransform({ minX: 0, minY: 0, maxX: 100, maxY: 50 }, 200, 100)
    const view = applyCamera(fit, { scale: 3, panX: 5, panY: 7 })
    expect(view.scale).toBeCloseTo(fit.scale * 3)
    expect(view.offsetX).toBeCloseTo(5 + 3 * fit.offsetX)
    expect(view.offsetY).toBeCloseTo(7 + 3 * fit.offsetY)
  })

  it('describes the live gesture as a delta from the committed camera', () => {
    expect(gestureDelta({ scale: 2, panX: 10, panY: 20 }, { scale: 4, panX: 30, panY: 50 })).toEqual({
      scale: 2,
      panX: 10,
      panY: 10,
    })
  })

  it('returns only entities inside the queried world window', () => {
    const entities: DrawingEntity[] = [
      { type: 'line', layer: 'A', x1: 0, y1: 0, x2: 10, y2: 0 },
      { type: 'line', layer: 'A', x1: 500, y1: 500, x2: 520, y2: 500 },
      { type: 'circle', layer: 'A', cx: 1000, cy: 1000, r: 4 },
    ]
    const index = buildSpatialIndex(entities)
    const nearOrigin = querySpatialIndex(index, { minX: -5, minY: -5, maxX: 20, maxY: 20 })
    expect(nearOrigin).toContain(0)
    expect(nearOrigin).not.toContain(1)
    expect(nearOrigin).not.toContain(2)
  })
})

describe('stress plan', () => {
  it('builds a multi-sheet drawing with tens of thousands of entities and an isolated probe', () => {
    const entities = buildStressPlan()
    expect(entities.length).toBeGreaterThan(20000)
    const probe = entities.find(
      (entity) => entity.type === 'line' && entity.color === STRESS_PROBE.color && entity.y1 === STRESS_PROBE.y1,
    )
    expect(probe?.type).toBe('line')
  })
})
