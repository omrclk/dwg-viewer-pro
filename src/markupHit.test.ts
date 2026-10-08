import { describe, expect, it } from 'vitest'
import { nearestMarkup, translatePoint } from './markupHit'
import type { SketchShape } from './drawTools'

const line: SketchShape = {
  id: 'line-1',
  kind: 'line',
  color: '#fff',
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ],
}

describe('nearestMarkup', () => {
  it('picks the sketch under the finger, not only the last object', () => {
    const hit = nearestMarkup({ x: 5, y: 0.2 }, 2, [line], [{ id: 'm1', points: [{ x: 40, y: 40 }] }], [
      { id: 'n1', point: { x: 1, y: 8 } },
    ])
    expect(hit).toEqual({ kind: 'sketch', id: 'line-1' })
  })

  it('picks a nearby note when no sketch is close', () => {
    const hit = nearestMarkup({ x: 1, y: 8 }, 3, [line], [], [{ id: 'n1', point: { x: 1, y: 8 } }])
    expect(hit).toEqual({ kind: 'note', id: 'n1' })
  })

  it('translates a point', () => {
    expect(translatePoint({ x: 2, y: 3 }, 4, -1)).toEqual({ x: 6, y: 2 })
  })
})
