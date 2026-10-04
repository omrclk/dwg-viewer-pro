import { describe, expect, it } from 'vitest'
import {
  extendSketchShape,
  filletSketchShape,
  findNearestSketchShape,
  offsetSketchShape,
  trimSketchShape,
} from './editTools'
import type { SketchShape } from './drawTools'

const line: SketchShape = {
  id: 'line-1',
  kind: 'line',
  color: '#fff',
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
}

describe('editTools', () => {
  it('finds nearest sketch line', () => {
    const hit = findNearestSketchShape([line], { x: 50, y: 2 }, 10)
    expect(hit?.id).toBe('line-1')
  })

  it('trims sketch shape', () => {
    expect(trimSketchShape([line], 'line-1')).toHaveLength(0)
  })

  it('extends line to target', () => {
    const extended = extendSketchShape(line, { x: 120, y: 0 })
    expect(extended?.points[1]).toEqual({ x: 120, y: 0 })
  })

  it('offsets line', () => {
    const offset = offsetSketchShape(line, { x: 50, y: 20 })
    expect(offset?.points).toHaveLength(2)
  })

  it('fillets rectangle', () => {
    const rect: SketchShape = {
      id: 'rect-1',
      kind: 'rect',
      color: '#fff',
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 30 },
      ],
    }
    const next = filletSketchShape(rect, 6)
    expect(next?.cornerRadius).toBe(6)
  })
})
