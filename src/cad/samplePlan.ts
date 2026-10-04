import {
  ACadVersion,
  Arc,
  BlockRecord,
  CadDocument,
  Circle,
  Color,
  DimensionLinear,
  DwgWriter,
  Ellipse,
  Hatch,
  HatchBoundaryPath,
  HatchBoundaryPathPolyline,
  Insert,
  Layer,
  Leader,
  Line,
  LwPolyline,
  LwPolylineVertex,
  MText,
  Spline,
  TextEntity,
  XYZ,
  XY,
} from '@node-projects/acad-ts'

export function buildSampleDocument() {
  const doc = new CadDocument(ACadVersion.AC1032)
  const walls = new Layer('WALLS')
  walls.color = new Color(1)
  const columns = new Layer('COLUMNS')
  columns.color = new Color(5)
  const text = new Layer('TEXT')
  text.color = new Color(3)
  const hatch = new Layer('HATCH')
  hatch.color = new Color(4)
  const site = new Layer('SITE')
  site.color = new Color(2)
  doc.layers.add(walls)
  doc.layers.add(columns)
  doc.layers.add(text)
  doc.layers.add(hatch)
  doc.layers.add(site)

  const outline = new LwPolyline([
    new LwPolylineVertex(new XY(0, 0)),
    new LwPolylineVertex(new XY(120, 0)),
    new LwPolylineVertex(new XY(120, 80)),
    new LwPolylineVertex(new XY(0, 80)),
  ])
  outline.isClosed = true
  outline.layer = walls
  outline.vertices[1].bulge = 0.4
  doc.modelSpace.entities.add(outline)

  const column = new Circle(new XYZ(30, 30, 0), 6)
  column.layer = columns
  doc.modelSpace.entities.add(column)

  const door = new Arc(new XYZ(70, 0, 0), 12, 0, Math.PI / 2)
  door.layer = walls
  doc.modelSpace.entities.add(door)

  const ellipse = new Ellipse()
  ellipse.center = new XYZ(90, 55, 0)
  ellipse.majorAxisEndPoint = new XYZ(16, 0, 0)
  ellipse.radiusRatio = 0.45
  ellipse.layer = columns
  doc.modelSpace.entities.add(ellipse)

  const spline = new Spline()
  spline.degree = 3
  spline.fitPoints = [new XYZ(0, 90, 0), new XYZ(30, 110, 0), new XYZ(70, 96, 0), new XYZ(120, 112, 0)]
  spline.updateFromFitPoints()
  spline.layer = site
  doc.modelSpace.entities.add(spline)

  const room = new Hatch()
  room.isSolid = true
  room.layer = hatch
  const boundary = new HatchBoundaryPath()
  const edge = new HatchBoundaryPathPolyline()
  edge.isClosed = true
  edge.vertices = [new XYZ(10, 10, 0), new XYZ(48, 10, 0), new XYZ(48, 36, 0), new XYZ(10, 36, 0)]
  boundary.edges.push(edge)
  room.paths.push(boundary)
  doc.modelSpace.entities.add(room)

  const label = new TextEntity('DWG Viewer Pro')
  label.insertPoint = new XYZ(8, 86, 0)
  label.height = 4
  label.layer = text
  doc.modelSpace.entities.add(label)

  const note = new MText('Kat plani\\PModel')
  note.insertPoint = new XYZ(8, 70, 0)
  note.height = 3.2
  note.layer = text
  doc.modelSpace.entities.add(note)

  const windowBlock = new BlockRecord('WINDOW')
  const frame = new Line(new XYZ(0, 0, 0), new XYZ(16, 0, 0))
  frame.layer = walls
  windowBlock.entities.add(frame)
  const mullion = new Line(new XYZ(8, -2, 0), new XYZ(8, 2, 0))
  mullion.layer = walls
  windowBlock.entities.add(mullion)
  doc.blockRecords.add(windowBlock)

  const nested = new BlockRecord('PAIR')
  const left = new Insert(windowBlock)
  left.insertPoint = new XYZ(0, 0, 0)
  nested.entities.add(left)
  const right = new Insert(windowBlock)
  right.insertPoint = new XYZ(20, 0, 0)
  nested.entities.add(right)
  doc.blockRecords.add(nested)

  const placed = new Insert(nested)
  placed.insertPoint = new XYZ(20, 50, 0)
  placed.rotation = Math.PI / 12
  placed.layer = walls
  doc.modelSpace.entities.add(placed)

  const dimension = new DimensionLinear()
  dimension.firstPoint = new XYZ(0, 0, 0)
  dimension.secondPoint = new XYZ(120, 0, 0)
  dimension.offset = 14
  try {
    dimension.updateBlock()
  } catch {
    // Synthetic geometry is drawn when the anonymous block has no curves.
  }
  dimension.layer = text
  doc.modelSpace.entities.add(dimension)

  const leader = new Leader()
  leader.vertices = [new XYZ(30, 30, 0), new XYZ(46, 48, 0), new XYZ(68, 48, 0)]
  leader.layer = text
  doc.modelSpace.entities.add(leader)

  const paper = new Line(new XYZ(0, 0, 0), new XYZ(40, 0, 0))
  paper.layer = walls
  doc.paperSpace?.entities.add(paper)

  return doc
}

export function sampleDwgBytes() {
  return DwgWriter.writeToBuffer(buildSampleDocument())
}

export const SAMPLE_RICH_DXF = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1027
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
0
LAYER
2
WALLS
70
0
62
1
6
CONTINUOUS
0
LAYER
2
TEXT
70
0
62
3
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
WINDOW
70
0
10
0
20
0
0
LINE
8
WALLS
10
0
20
0
11
10
21
0
0
ENDBLK
0
BLOCK
2
PAIR
70
0
10
0
20
0
0
INSERT
8
WALLS
2
WINDOW
10
0
20
0
41
1
42
1
50
0
0
INSERT
8
WALLS
2
WINDOW
10
18
20
0
41
1
42
1
50
0
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
WALLS
10
40
20
40
40
12
0
ARC
8
WALLS
10
70
20
0
40
15
50
0
51
90
0
LWPOLYLINE
8
WALLS
90
3
70
1
10
0
20
20
42
0.5
10
40
20
20
10
40
20
50
0
TEXT
8
TEXT
10
5
20
60
40
4
1
SALON
50
0
0
MTEXT
8
TEXT
10
5
20
70
40
3
1
Kat\\Pplani
0
ELLIPSE
8
WALLS
10
80
20
40
11
18
21
0
40
0.5
41
0
42
6.283185307179586
0
SPLINE
8
WALLS
70
0
74
3
11
0
21
80
11
20
21
95
11
50
21
88
0
HATCH
8
WALLS
70
1
91
1
92
7
93
4
10
0
20
0
10
20
20
0
10
20
20
12
10
0
20
12
0
INSERT
8
WALLS
2
PAIR
10
10
20
10
41
2
42
2
50
0
0
ENDSEC
0
EOF
`
