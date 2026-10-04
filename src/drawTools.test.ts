import { describe, expect, it } from 'vitest'
import {
  actionIdToDrawTool,
  arcPathFromThreePoints,
  canFinalizeDrawShape,
  isDragDrawTool,
  rectFromCorners,
} from './drawTools'

describe('drawTools', () => {
  it('maps action ids to draw tools', () => {
    expect(actionIdToDrawTool('draw-line')).toBe('line')
    expect(actionIdToDrawTool('draw-circle')).toBe('circle')
    expect(actionIdToDrawTool('draw-rect')).toBe('rect')
    expect(actionIdToDrawTool('draw-ellipse')).toBe('ellipse')
    expect(actionIdToDrawTool('ann-arrow')).toBe('arrow')
    expect(actionIdToDrawTool('draw-arc')).toBe('arc')
    expect(actionIdToDrawTool('unknown')).toBeNull()
  })

  it('detects drag tools', () => {
    expect(isDragDrawTool('line')).toBe(true)
    expect(isDragDrawTool('circle')).toBe(true)
    expect(isDragDrawTool('polyline')).toBe(false)
  })

  it('builds rectangle from corners', () => {
    const box = rectFromCorners({ x: 10, y: 20 }, { x: 30, y: 50 })
    expect(box).toEqual({ x: 10, y: 20, width: 20, height: 30 })
  })

  it('finalizes shapes with enough points', () => {
    expect(canFinalizeDrawShape('line', [{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(true)
    expect(canFinalizeDrawShape('arc', [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }])).toBe(true)
    expect(canFinalizeDrawShape('line', [{ x: 0, y: 0 }])).toBe(false)
  })

  it('builds arc path', () => {
    const path = arcPathFromThreePoints({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 })
    expect(path.startsWith('M')).toBe(true)
    expect(path.includes('A')).toBe(true)
  })
})
