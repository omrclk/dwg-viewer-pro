import { describe, expect, it } from 'vitest'
import {
  ACadVersion,
  BlockRecord,
  CadDocument,
  DwgWriter,
  Insert,
  Layer,
  Line,
  LwPolyline,
  LwPolylineVertex,
  MText,
  TextEntity,
  TextStyle,
  XY,
  XYZ,
} from '@node-projects/acad-ts'
import { parseDxfDocument } from '../dxfParser'
import { boundsForEntities } from '../dxfTransform'
import { keepFileAttributePlacement, readDrawingBytes } from './readDrawing'

function regressionDwg() {
  const doc = new CadDocument(ACadVersion.AC1032)
  const walls = new Layer('WALLS')
  doc.layers.add(walls)

  const border = new LwPolyline([
    new LwPolylineVertex(new XY(0, 0)),
    new LwPolylineVertex(new XY(200, 0)),
    new LwPolylineVertex(new XY(200, 80)),
    new LwPolylineVertex(new XY(0, 80)),
  ])
  border.isClosed = true
  border.layer = walls
  doc.modelSpace.entities.add(border)

  const style = new TextStyle('BASLIK')
  style.height = 4
  style.lastHeight = 900
  doc.textStyles.add(style)
  const fixed = new TextEntity('SABIT')
  fixed.height = 0
  fixed.style = style
  fixed.insertPoint = new XYZ(20, 20, 0)
  fixed.layer = walls
  doc.modelSpace.entities.add(fixed)

  const annotative = new MText('GIRIS')
  annotative.height = 4000
  annotative.isAnnotative = true
  annotative.insertPoint = new XYZ(40, 40, 0)
  annotative.layer = walls
  doc.modelSpace.entities.add(annotative)

  const coded = new MText('\\H80;GIRIS')
  coded.height = 2
  coded.insertPoint = new XYZ(30, 50, 0)
  coded.layer = walls
  doc.modelSpace.entities.add(coded)

  const wide = new TextEntity('GENIS')
  wide.height = 2.5
  wide.widthFactor = 80
  wide.insertPoint = new XYZ(60, 16, 0)
  wide.layer = walls
  doc.modelSpace.entities.add(wide)

  const block = new BlockRecord('KAPI')
  block.entities.add(new Line(new XYZ(0, 0, 0), new XYZ(10, 0, 0)))
  const label = new TextEntity('KAPI')
  label.height = 2.5
  label.widthFactor = 0.8
  label.insertPoint = new XYZ(1, 1, 0)
  block.entities.add(label)
  doc.blockRecords.add(block)
  const insert = new Insert(block)
  insert.insertPoint = new XYZ(100, 30, 0)
  insert.xScale = 4
  insert.yScale = 4
  insert.layer = walls
  doc.modelSpace.entities.add(insert)

  const outlier = new TextEntity('UZAK')
  outlier.height = 2
  outlier.insertPoint = new XYZ(1e7, 1e7, 0)
  outlier.layer = walls
  doc.modelSpace.entities.add(outlier)

  doc.paperSpace?.entities.add(new Line(new XYZ(0, 0, 0), new XYZ(100, 0, 0)))
  doc.paperSpace?.entities.add(new Line(new XYZ(0, 0, 0), new XYZ(0, 50, 0)))
  const paper = new TextEntity('ANTET')
  paper.height = 3.5
  paper.insertPoint = new XYZ(10, 10, 0)
  doc.paperSpace?.entities.add(paper)

  return DwgWriter.writeToBuffer(doc)
}

describe('text height against the drawing', () => {
  it('keeps real heights and shrinks annotative, coded and percent-width text', async () => {
    const drawing = await readDrawingBytes(new Uint8Array(regressionDwg()), 'dwg')
    const model = drawing.layouts.find((layout) => layout.isModel)
    const texts = model?.entities.filter((entity) => entity.type === 'text') ?? []
    const at = (text: string, x: number) => texts.find((entity) => entity.type === 'text' && entity.text === text && Math.abs(entity.x - x) < 3)

    const fixed = at('SABIT', 20)
    expect(fixed && fixed.type === 'text' && fixed.height).toBeCloseTo(4, 2)

    const annotative = at('GIRIS', 40)
    expect(annotative && annotative.type === 'text' && annotative.annotative).toBe(true)
    expect(annotative && annotative.type === 'text' ? annotative.height : 0).toBeCloseTo(2, 1)
    expect(annotative && annotative.type === 'text' ? annotative.height : 99).toBeLessThan(80 * 0.22)

    const coded = at('GIRIS', 30)
    const absolute = coded && coded.type === 'text' ? coded.lines?.flat().find((run) => run.absoluteHeight) : undefined
    expect(absolute?.absoluteHeight ?? 99).toBeLessThanOrEqual(80 * 0.22 + 0.01)
    expect(coded && coded.type === 'text' ? coded.height : 0).toBeCloseTo(2, 2)

    const wide = at('GENIS', 60)
    expect(wide && wide.type === 'text' && wide.widthFactor).toBeCloseTo(0.8, 2)
    expect(wide && wide.type === 'text' ? wide.height : 0).toBeCloseTo(2.5, 2)

    const scaled = texts.find((entity) => entity.type === 'text' && entity.text === 'KAPI')
    expect(scaled && scaled.type === 'text' && scaled.height).toBeCloseTo(10, 1)
    expect(scaled && scaled.type === 'text' && scaled.widthFactor).toBeCloseTo(0.8, 2)

    const bounds = boundsForEntities(model?.entities ?? [])
    expect(bounds.maxX).toBeLessThan(500)
    expect(bounds.maxY).toBeLessThan(200)
    expect(bounds.minX).toBeGreaterThan(-5)

    const paper = drawing.layouts.find((layout) => !layout.isModel)
    const antet = paper?.entities.find((entity) => entity.type === 'text' && entity.text === 'ANTET')
    expect(antet && antet.type === 'text' && antet.height).toBeCloseTo(3.5, 2)
  })

  it('reads a fixed style height and insert scale from DXF', () => {
    const doc = parseDxfDocument(`0
SECTION
2
TABLES
0
TABLE
2
STYLE
0
STYLE
2
BASLIK
40
4
41
80
0
ENDTAB
0
ENDSEC
0
SECTION
2
BLOCKS
0
BLOCK
2
KAPI
10
0
20
0
0
TEXT
8
0
10
1
20
1
40
2.5
41
0.8
1
KAPI
0
ENDBLK
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
0
10
0
20
0
11
100
21
50
0
TEXT
8
0
7
BASLIK
10
12
20
12
40
0
1
SABIT
0
INSERT
8
0
2
KAPI
10
40
20
10
41
4
42
4
0
ENDSEC
0
EOF
`)
    const texts = doc.layouts[0].entities.filter((entity) => entity.type === 'text')
    const fixed = texts.find((entity) => entity.type === 'text' && entity.text === 'SABIT')
    const scaled = texts.find((entity) => entity.type === 'text' && entity.text === 'KAPI')
    expect(fixed && fixed.type === 'text' && fixed.height).toBeCloseTo(4, 2)
    expect(fixed && fixed.type === 'text' && fixed.widthFactor).toBeCloseTo(0.8, 2)
    expect(scaled && scaled.type === 'text' && scaled.height).toBeCloseTo(10, 2)
    expect(scaled && scaled.type === 'text' && scaled.x).toBeCloseTo(44, 2)
  })

  it('leaves stored attribute coordinates alone while the file is built', () => {
    const calls: string[] = []
    const fake = {
      prototype: {
        _build(this: { cadObject?: { applyAttributeTransform?: () => void } }) {
          this.cadObject?.applyAttributeTransform?.()
          calls.push('build')
        },
      },
    }
    keepFileAttributePlacement(fake)
    const insert = {
      applyAttributeTransform() {
        calls.push('apply')
      },
    }
    fake.prototype._build.call({ cadObject: insert }, null)
    expect(calls).toEqual(['build'])
    insert.applyAttributeTransform()
    expect(calls).toEqual(['build', 'apply'])
  })
})
