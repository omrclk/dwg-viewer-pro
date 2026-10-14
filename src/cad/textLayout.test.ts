import { describe, expect, it } from 'vitest'
import { parseDxfDocument } from '../dxfParser'
import { boundsForEntities } from '../dxfTransform'
import { orderSolidPoints } from './geometry'
import { parseMText, plainMText, screenTextSize } from './mtext'
import { readDrawingBytes } from './readDrawing'
import { sampleDwgBytes } from './samplePlan'

describe('mtext codes', () => {
  it('keeps Turkish letters, symbols, height and color codes', () => {
    const raw = 'G\\U+00FCNE\\U+015E ENERJ\\U+0130S\\U+0130\\P%%c200 \\H1.2x;kV {\\C1;trafo} \\U+011F\\U+00FC\\U+015F\\U+0131\\U+00F6\\U+00E7'
    expect(plainMText(raw)).toBe('GüNEŞ ENERJİSİ\nØ200 kV trafo ğüşıöç')
    const lines = parseMText(raw)
    expect(lines).toHaveLength(2)
    expect(lines[1].some((run) => run.heightScale === 1.2 && run.text.startsWith('kV'))).toBe(true)
    expect(lines[1].some((run) => run.color === '#ff0000' && run.text === 'trafo')).toBe(true)
  })

  it('does not turn a paragraph into a stretched box', () => {
    const lines = parseMText('{\\W0.8;\\Q15;GES \\fArial|b0|i0;plan}')
    const joined = lines.flat().map((run) => run.text).join('')
    expect(joined).toBe('GES plan')
    expect(lines[0][0]?.widthFactor).toBe(0.8)
    expect(lines[0][0]?.oblique).toBe(15)
    expect(lines[0].every((run) => run.absoluteHeight === undefined || run.absoluteHeight < 100)).toBe(true)
  })
})

describe('text screen size', () => {
  it('uses world height times zoom and hides labels under 2px', () => {
    expect(screenTextSize(2.5, 4)).toBe(10)
    expect(screenTextSize(0.15, 8)).toBe(0)
    expect(screenTextSize(250, 0)).toBe(0)
    expect(screenTextSize(Number.NaN, 10)).toBe(0)
  })
})

describe('drawing extents', () => {
  it('drops a far outlier and keeps the real plan', () => {
    const bounds = boundsForEntities([
      { type: 'line', layer: '0', x1: 0, y1: 0, x2: 120, y2: 0 },
      { type: 'line', layer: '0', x1: 120, y1: 0, x2: 120, y2: 80 },
      { type: 'line', layer: '0', x1: 0, y1: 80, x2: 0, y2: 0 },
      { type: 'line', layer: '0', x1: 10, y1: 10, x2: 1e9, y2: 10 },
    ])
    expect(bounds.maxX).toBeLessThan(500)
    expect(bounds.maxY).toBeLessThan(200)
    expect(bounds.minX).toBeLessThan(5)
  })

  it('uses header extents when they cover the geometry', () => {
    const bounds = boundsForEntities(
      [{ type: 'line', layer: '0', x1: 10, y1: 10, x2: 90, y2: 70 }],
      { minX: 0, minY: 0, maxX: 120, maxY: 80 },
    )
    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 120, maxY: 80 })
  })

  it('keeps a far text anchor from stretching the plan', () => {
    const bounds = boundsForEntities([
      { type: 'line', layer: '0', x1: 0, y1: 0, x2: 100, y2: 0 },
      { type: 'line', layer: '0', x1: 0, y1: 0, x2: 0, y2: 40 },
      { type: 'text', layer: '0', x: 1e7, y: 1e7, text: 'UZAK', height: 5000, rotation: 0 },
    ])
    expect(bounds.maxX).toBeLessThan(200)
    expect(bounds.maxY).toBeLessThan(80)
  })

  it('ignores a stale header box that is orders of magnitude too large', () => {
    const bounds = boundsForEntities(
      [{ type: 'line', layer: '0', x1: 0, y1: 0, x2: 100, y2: 50 }],
      { minX: -1e8, minY: -1e8, maxX: 1e8, maxY: 1e8 },
    )
    expect(bounds.maxX).toBeLessThan(200)
    expect(bounds.minX).toBeGreaterThan(-10)
  })
})

describe('solid corners', () => {
  it('uncrosses the AutoCAD SOLID vertex order', () => {
    const points = orderSolidPoints([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 4 },
      { x: 10, y: 4 },
    ])
    expect(points.map((point) => point.y)).toEqual([0, 0, 4, 4])
    expect(points[2]).toEqual({ x: 10, y: 4 })
  })
})

describe('dxf text justification', () => {
  it('reads alignment, width factor, oblique angle and MTEXT attachment', () => {
    const doc = parseDxfDocument(`0
SECTION
2
HEADER
9
$EXTMIN
10
0
20
0
9
$EXTMAX
10
200
20
100
0
ENDSEC
0
SECTION
2
ENTITIES
0
TEXT
8
TEXT
10
0
20
0
11
40
21
12
40
2.5
41
0.8
50
90
51
15
72
1
73
2
1
TRAFO
0
MTEXT
8
TEXT
10
8
20
58
40
2.4
41
80
71
1
1
G\\U+00FCNE\\U+015E\\P%%c200
0
LWPOLYLINE
8
SITE
90
2
70
0
43
0.8
10
0
20
0
10
10
20
0
0
ENDSEC
0
EOF
`)
    const text = doc.layouts[0].entities.find((entity) => entity.type === 'text' && entity.text === 'TRAFO')
    expect(text && text.type === 'text' && text.x).toBe(40)
    expect(text && text.type === 'text' && text.y).toBe(12)
    expect(text && text.type === 'text' && text.halign).toBe('center')
    expect(text && text.type === 'text' && text.valign).toBe('middle')
    expect(text && text.type === 'text' && text.widthFactor).toBe(0.8)
    expect(text && text.type === 'text' && text.oblique).toBe(15)
    expect(text && text.type === 'text' && text.rotation).toBe(90)
    expect(text && text.type === 'text' && text.height).toBe(2.5)
    const mtext = doc.layouts[0].entities.find((entity) => entity.type === 'text' && entity.text.includes('GüNEŞ'))
    expect(mtext && mtext.type === 'text' && mtext.valign).toBe('top')
    expect(mtext && mtext.type === 'text' && mtext.boxWidth).toBe(80)
    expect(mtext && mtext.type === 'text' && mtext.text).toContain('Ø200')
    const cable = doc.layouts[0].entities.find((entity) => entity.type === 'polyline')
    expect(cable && cable.type === 'polyline' && cable.strokeWidth).toBe(0.8)
    expect(doc.extents).toEqual({ minX: 0, minY: 0, maxX: 200, maxY: 100 })
  })
})

describe('sample dwg text', () => {
  it('keeps real text height, rotation and Turkish MTEXT from the writer', async () => {
    const drawing = await readDrawingBytes(sampleDwgBytes(), 'dwg')
    const model = drawing.layouts.find((layout) => layout.isModel)
    const texts = model?.entities.filter((entity) => entity.type === 'text') ?? []
    const trafo = texts.find((entity) => entity.type === 'text' && entity.text === 'TRAFO')
    expect(trafo && trafo.type === 'text' && trafo.height).toBeCloseTo(2.2, 2)
    expect(trafo && trafo.type === 'text' && Math.abs(trafo.rotation)).toBeGreaterThan(80)
    expect(trafo && trafo.type === 'text' && trafo.widthFactor).toBeCloseTo(0.85, 2)
    const ges = texts.find((entity) => entity.type === 'text' && entity.text.includes('GüNEŞ'))
    expect(ges && ges.type === 'text' && ges.height).toBeCloseTo(2.4, 2)
    expect(ges && ges.type === 'text' && ges.text).toContain('Ø200')
    const tiny = texts.find((entity) => entity.type === 'text' && entity.text === 'etiket')
    expect(tiny && tiny.type === 'text' && tiny.height).toBeCloseTo(0.15, 2)
    expect(screenTextSize(tiny && tiny.type === 'text' ? tiny.height : 0, 8)).toBe(0)
  })
})
