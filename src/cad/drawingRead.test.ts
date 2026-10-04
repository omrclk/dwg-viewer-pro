import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseDxfDocument, parseDxfEntities } from '../dxfParser'
import { tessellateBulge } from './geometry'
import { readDrawingBytes } from './readDrawing'
import { SAMPLE_RICH_DXF, sampleDwgBytes } from './samplePlan'

describe('dxf geometry', () => {
  it('keeps the original line, circle and closed polyline sample', () => {
    const entities = parseDxfEntities(`0
SECTION
2
ENTITIES
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
0
ENDSEC
0
EOF
`)
    expect(entities.map((entity) => entity.type)).toEqual(['line', 'circle', 'polyline'])
    const line = entities[0]
    const circle = entities[1]
    const polyline = entities[2]
    expect(line.layer).toBe('WALLS')
    if (line.type === 'line') expect(line.x2).toBe(100)
    expect(circle.layer).toBe('COLS')
    if (circle.type === 'circle') expect(circle.r).toBe(25)
    if (polyline.type === 'polyline') {
      expect(polyline.closed).toBe(true)
      expect(polyline.points.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('tessellates a positive bulge to the left of travel', () => {
    const points = tessellateBulge({ x: 0, y: 100 }, { x: 40, y: 100 }, 0.5, 8)
    const mid = points[Math.floor(points.length / 2)]
    expect(mid.y).toBeLessThan(100)
    expect(mid.y).toBeGreaterThan(85)
  })

  it('reads text, hatch, ellipse, spline, bulge and nested blocks', () => {
    const doc = parseDxfDocument(SAMPLE_RICH_DXF)
    const entities = doc.layouts[0].entities
    expect(entities.some((entity) => entity.type === 'line')).toBe(true)
    expect(entities.some((entity) => entity.type === 'circle')).toBe(true)
    expect(entities.some((entity) => entity.type === 'arc')).toBe(true)
    expect(entities.some((entity) => entity.type === 'text' && entity.text.includes('SALON'))).toBe(true)
    expect(entities.some((entity) => entity.type === 'text' && entity.text.includes('Kat'))).toBe(true)
    expect(entities.some((entity) => entity.type === 'solid')).toBe(true)
    expect(entities.some((entity) => entity.type === 'polyline' && entity.points.length > 4)).toBe(true)
    const lines = entities.filter((entity) => entity.type === 'line')
    expect(lines.length).toBeGreaterThanOrEqual(3)
    if (lines[1]?.type === 'line' && lines[2]?.type === 'line') {
      expect(lines[1].x1).toBeCloseTo(10)
      expect(lines[2].x1).toBeCloseTo(46)
    }
    const bulged = entities.find((entity) => entity.type === 'polyline' && entity.points.some((point) => point.y < 19 && point.y > 5 && point.x > 5 && point.x < 35))
    expect(bulged).toBeTruthy()
    expect(doc.layers.find((layer) => layer.name === 'WALLS')?.color).toBe('#ff0000')
  })
})

describe('dwg reader', () => {
  it('round-trips a real DWG with nested blocks and curves', async () => {
    const bytes = sampleDwgBytes()
    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe('AC1032')
    const drawing = await readDrawingBytes(bytes, 'dwg')
    const model = drawing.layouts.find((layout) => layout.isModel)
    expect(model).toBeTruthy()
    const entities = model?.entities ?? []
    expect(entities.some((entity) => entity.type === 'circle')).toBe(true)
    expect(entities.some((entity) => entity.type === 'arc')).toBe(true)
    expect(entities.some((entity) => entity.type === 'text')).toBe(true)
    expect(entities.some((entity) => entity.type === 'solid' || entity.type === 'polyline')).toBe(true)
    const lines = entities.filter((entity) => entity.type === 'line')
    expect(lines.length).toBeGreaterThanOrEqual(4)
    expect(drawing.layers.some((layer) => layer.name === 'WALLS')).toBe(true)
    expect(drawing.version).toBe('2018')

    const dxf = await readDrawingBytes(new TextEncoder().encode(SAMPLE_RICH_DXF), 'dxf')
    expect(dxf.layouts[0].entities.some((entity) => entity.type === 'circle')).toBe(true)
    expect(dxf.layouts[0].entities.some((entity) => entity.type === 'text')).toBe(true)

    mkdirSync('public/samples', { recursive: true })
    writeFileSync('public/samples/ornek-plan.dwg', bytes)
    writeFileSync('public/samples/ornek-plan.dxf', SAMPLE_RICH_DXF)
  })
})
