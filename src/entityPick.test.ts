import { describe, expect, it } from 'vitest'
import { findNearestEntity } from './entityPick'

describe('entityPick', () => {
  it('finds nearest line entity', () => {
    const hit = findNearestEntity(
      { x: 50, y: 1 },
      [
        {
          type: 'line',
          layer: 'A-WALL',
          x1: 0,
          y1: 0,
          x2: 100,
          y2: 0,
        },
      ],
      5,
    )
    expect(hit?.kind).toBe('Çizgi')
    expect(hit?.layer).toBe('A-WALL')
  })

  it('returns null when nothing is close enough', () => {
    const hit = findNearestEntity(
      { x: 50, y: 50 },
      [
        {
          type: 'line',
          layer: 'A-WALL',
          x1: 0,
          y1: 0,
          x2: 100,
          y2: 0,
        },
      ],
      2,
    )
    expect(hit).toBeNull()
  })
})
