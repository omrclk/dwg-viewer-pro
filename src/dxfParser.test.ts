import { describe, expect, it } from 'vitest'
import { parseDxfEntities } from './dxfParser'

const SAMPLE_DXF = `0
SECTION
0
ENDSEC
0
EOF
0
LINE
8
WALLS
10
0
20
0
11
100
21
0
0
CIRCLE
8
COLS
10
50
20
50
40
25
0
LWPOLYLINE
8
ROOF
90
3
70
1
10
0
20
100
10
50
20
120
10
100
20
100
`

describe('dxfParser', () => {
  it('parses line, circle and polyline entities with layers', () => {
    const entities = parseDxfEntities(SAMPLE_DXF)
    expect(entities).toHaveLength(3)

    const line = entities.find((entity) => entity.type === 'line')
    expect(line?.layer).toBe('WALLS')
    if (line?.type === 'line') {
      expect(line.x2).toBe(100)
    }

    const circle = entities.find((entity) => entity.type === 'circle')
    expect(circle?.layer).toBe('COLS')
    if (circle?.type === 'circle') {
      expect(circle.r).toBe(25)
    }

    const polyline = entities.find((entity) => entity.type === 'polyline')
    expect(polyline?.layer).toBe('ROOF')
    if (polyline?.type === 'polyline') {
      expect(polyline.closed).toBe(true)
      expect(polyline.points).toHaveLength(3)
    }
  })
})
