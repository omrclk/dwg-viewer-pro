import type { DrawingEntity } from '../drawingTypes'

/** Magenta hairline through the empty gap between sheet rows. Pixel tests measure this stroke. */
export const STRESS_PROBE = {
  x1: 400,
  y1: 4000,
  x2: 11600,
  y2: 4000,
  color: '#ff2bd6',
}

const GRID = ['#d5dde3', '#8fd0ff', '#f0d060', '#67e0c3']

function sheet(originX: number, originY: number, index: number): DrawingEntity[] {
  const width = 3400
  const height = 3000
  const entities: DrawingEntity[] = []
  const left = originX
  const right = originX + width
  const bottom = originY
  const top = originY + height
  entities.push({
    type: 'polyline',
    layer: 'PAFTA',
    closed: true,
    strokeWidth: 25,
    color: '#f5d90a',
    points: [
      { x: left, y: bottom },
      { x: right, y: bottom },
      { x: right, y: top },
      { x: left, y: top },
    ],
  })
  for (let x = left; x <= right; x += 2) {
    entities.push({
      type: 'line',
      layer: 'GRID',
      color: GRID[(x + index) % GRID.length],
      x1: x,
      y1: bottom,
      x2: x,
      y2: top,
    })
  }
  for (let y = bottom; y <= top; y += 2) {
    entities.push({
      type: 'line',
      layer: 'GRID',
      color: GRID[(y + index) % GRID.length],
      x1: left,
      y1: y,
      x2: right,
      y2: y,
    })
  }
  for (let x = left + 60; x < right; x += 120) {
    for (let y = bottom + 60; y < top; y += 120) {
      entities.push({
        type: 'polyline',
        layer: 'EKIPMAN',
        closed: true,
        color: '#ff8a3d',
        points: [
          { x, y },
          { x: x + 36, y },
          { x: x + 36, y: y + 22 },
          { x, y: y + 22 },
        ],
      })
    }
  }
  for (let x = left + 80; x < right; x += 200) {
    for (let y = bottom + 80; y < top; y += 200) {
      entities.push({ type: 'circle', layer: 'EKIPMAN', color: '#3ee0d0', cx: x, cy: y, r: 18 })
    }
  }
  entities.push({
    type: 'text',
    layer: 'YAZI',
    x: left + 80,
    y: top - 220,
    text: `PAFTA ${index + 1}`,
    height: 160,
    rotation: 0,
    color: '#f4f7fb',
    halign: 'left',
    valign: 'baseline',
  })
  entities.push({
    type: 'text',
    layer: 'YAZI',
    x: left + 80,
    y: bottom + 40,
    text: 'etiket',
    height: 1,
    rotation: 0,
    color: '#f4f7fb',
  })
  return entities
}

/** Landscape multi-sheet plan. Tens of thousands of entities, with a clear gap for the probe line. */
export function buildStressPlan(): DrawingEntity[] {
  const origins = [
    [200, 4300],
    [4200, 4300],
    [8200, 4300],
    [200, 400],
    [4200, 400],
    [8200, 400],
  ]
  const entities = origins.flatMap((origin, index) => sheet(origin[0], origin[1], index))
  entities.push({
    type: 'line',
    layer: 'PROBE',
    color: STRESS_PROBE.color,
    x1: STRESS_PROBE.x1,
    y1: STRESS_PROBE.y1,
    x2: STRESS_PROBE.x2,
    y2: STRESS_PROBE.y2,
  })
  return entities
}
