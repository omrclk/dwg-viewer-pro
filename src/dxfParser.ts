import type { DrawingDocument, DrawingEntity, DrawingLayerInfo, Point2, TextHAlign, TextVAlign } from './drawingTypes'
import { aciColor, dashForLineType, orderSolidPoints, sampleEllipse, tessellatePolyline } from './cad/geometry'
import { parseMText, plainMText } from './cad/mtext'
import { fitTextEntities } from './cad/textFit'

type Pair = [string, string]
type Group = { type: string; pairs: Pair[] }

const STRUCTURAL = new Set([
  'SECTION', 'ENDSEC', 'EOF', 'TABLE', 'ENDTAB', 'BLOCK', 'ENDBLK', 'SEQEND',
])

function pairsFromText(text: string): Pair[] {
  const rows = text.replace(/\r/g, '').split('\n')
  const pairs: Pair[] = []
  for (let index = 0; index < rows.length - 1; index += 2) {
    pairs.push([rows[index].trim(), rows[index + 1].trim()])
  }
  return pairs
}

function groupsFromPairs(pairs: Pair[]): Group[] {
  const groups: Group[] = []
  let index = 0
  while (index < pairs.length) {
    const [code, value] = pairs[index]
    if (code !== '0') {
      index += 1
      continue
    }
    const group: Group = { type: value.toUpperCase(), pairs: [] }
    index += 1
    while (index < pairs.length && pairs[index][0] !== '0') {
      group.pairs.push(pairs[index])
      index += 1
    }
    groups.push(group)
  }
  return groups
}

function num(group: Group, code: string, fallback = 0) {
  const match = group.pairs.find(([pairCode]) => pairCode === code)
  const value = match ? Number.parseFloat(match[1]) : fallback
  return Number.isFinite(value) ? value : fallback
}

function str(group: Group, code: string, fallback = '') {
  const match = group.pairs.find(([pairCode]) => pairCode === code)
  const value = match?.[1]?.trim()
  return value || fallback
}

function nums(group: Group, code: string) {
  return group.pairs.filter(([pairCode]) => pairCode === code).map(([, value]) => Number.parseFloat(value))
}

function styleOf(group: Group, layers: Map<string, DrawingLayerInfo>) {
  const layer = str(group, '8', '0') || '0'
  const colorIndex = num(group, '62', 256)
  const layerInfo = layers.get(layer)
  const color = colorIndex === 256 || colorIndex === 0
    ? layerInfo?.color
    : aciColor(Math.abs(colorIndex))
  const lineType = str(group, '6', '')
  return { layer, color, dash: dashForLineType(lineType) ?? undefined }
}

function polylineFromVertices(
  points: Point2[],
  bulges: number[],
  closed: boolean,
  style: ReturnType<typeof styleOf>,
  strokeWidth?: number,
): DrawingEntity | null {
  const sampled = tessellatePolyline(points, bulges, closed)
  if (sampled.length < 2) return null
  return {
    type: 'polyline',
    layer: style.layer,
    points: sampled,
    closed,
    color: style.color,
    dash: style.dash,
    ...(strokeWidth && strokeWidth > 0 ? { strokeWidth } : {}),
  }
}

function textCodes(horizontal: number, vertical: number): { halign: TextHAlign; valign: TextVAlign } {
  let halign: TextHAlign = 'left'
  let valign: TextVAlign = 'baseline'
  if (horizontal === 1 || horizontal === 4) halign = 'center'
  if (horizontal === 2) halign = 'right'
  if (vertical === 1) valign = 'bottom'
  if (vertical === 2 || horizontal === 4) valign = 'middle'
  if (vertical === 3) valign = 'top'
  return { halign, valign }
}

function mtextCodes(attachment: number): { halign: TextHAlign; valign: TextVAlign } {
  const safe = Math.min(9, Math.max(1, attachment || 1))
  const column = (safe - 1) % 3
  const row = Math.floor((safe - 1) / 3)
  return {
    halign: column === 1 ? 'center' : column === 2 ? 'right' : 'left',
    valign: row === 0 ? 'top' : row === 1 ? 'middle' : 'bottom',
  }
}

type TextStyleInfo = { height: number; width: number }

function entityFromGroup(group: Group, layers: Map<string, DrawingLayerInfo>, styles: Map<string, TextStyleInfo>): DrawingEntity | null {
  const style = styleOf(group, layers)

  if (group.type === 'LINE') {
    return {
      type: 'line',
      layer: style.layer,
      x1: num(group, '10'),
      y1: num(group, '20'),
      x2: num(group, '11'),
      y2: num(group, '21'),
      color: style.color,
      dash: style.dash,
    }
  }

  if (group.type === 'CIRCLE') {
    return {
      type: 'circle',
      layer: style.layer,
      cx: num(group, '10'),
      cy: num(group, '20'),
      r: Math.max(0.01, num(group, '40')),
      color: style.color,
      dash: style.dash,
    }
  }

  if (group.type === 'ARC') {
    return {
      type: 'arc',
      layer: style.layer,
      cx: num(group, '10'),
      cy: num(group, '20'),
      r: Math.max(0.01, num(group, '40')),
      start: num(group, '50'),
      end: num(group, '51'),
      color: style.color,
      dash: style.dash,
    }
  }

  if (group.type === 'POINT') {
    const x = num(group, '10')
    const y = num(group, '20')
    return { type: 'circle', layer: style.layer, cx: x, cy: y, r: 0.4, color: style.color }
  }

  if (group.type === 'SOLID' || group.type === 'TRACE') {
    const points = [10, 11, 12, 13].map((code) => ({ x: num(group, String(code)), y: num(group, String(code + 10)) }))
    return { type: 'solid', layer: style.layer, points: orderSolidPoints(points), color: style.color }
  }

  if (group.type === 'TEXT' || group.type === 'ATTRIB' || group.type === 'ATTDEF') {
    const raw = str(group, '1')
    const lines = parseMText(raw)
    const text = plainMText(raw)
    if (!text) return null
    const horizontal = num(group, '72')
    const vertical = num(group, '73')
    const alignX = num(group, '11', Number.NaN)
    const alignY = num(group, '21', Number.NaN)
    const justified = horizontal !== 0 || vertical !== 0
    const x = justified && Number.isFinite(alignX) ? alignX : num(group, '10')
    const y = justified && Number.isFinite(alignY) ? alignY : num(group, '20')
    const align = textCodes(horizontal, vertical)
    const named = styles.get(str(group, '7').toUpperCase())
    const rawHeight = num(group, '40', Number.NaN)
    const styleHeight = named?.height ?? 0
    const height = rawHeight > 1e-8 ? rawHeight : styleHeight > 1e-8 ? styleHeight : 2.5
    const rawWidth = num(group, '41', Number.NaN)
    const widthFactor = rawWidth > 1e-8 ? rawWidth : named?.width && named.width > 1e-8 ? named.width : 1
    return {
      type: 'text',
      layer: style.layer,
      x,
      y,
      text,
      lines,
      height,
      rotation: num(group, '50'),
      widthFactor,
      oblique: num(group, '51'),
      halign: align.halign,
      valign: align.valign,
      lineSpacing: 1,
      color: style.color,
    }
  }

  if (group.type === 'MTEXT') {
    const raw = group.pairs.filter(([code]) => code === '1' || code === '3').map(([, value]) => value).join('')
    const lines = parseMText(raw)
    const text = plainMText(raw)
    if (!text) return null
    const dirX = num(group, '11', Number.NaN)
    const dirY = num(group, '21', Number.NaN)
    const rotation = Number.isFinite(dirX) && Number.isFinite(dirY) && (Math.abs(dirX) > 1e-9 || Math.abs(dirY) > 1e-9)
      ? (Math.atan2(dirY, dirX) * 180) / Math.PI
      : (num(group, '50') * 180) / Math.PI
    const align = mtextCodes(num(group, '71', 1))
    const boxWidth = num(group, '41')
    const named = styles.get(str(group, '7').toUpperCase())
    const rawHeight = num(group, '40', Number.NaN)
    const styleHeight = named?.height ?? 0
    const height = rawHeight > 1e-8 ? rawHeight : styleHeight > 1e-8 ? styleHeight : 2.5
    return {
      type: 'text',
      layer: style.layer,
      x: num(group, '10'),
      y: num(group, '20'),
      text,
      lines,
      height,
      rotation,
      halign: align.halign,
      valign: align.valign,
      ...(boxWidth > 0 ? { boxWidth } : {}),
      lineSpacing: num(group, '44', 1) || 1,
      widthFactor: named?.width && named.width > 1e-8 ? named.width : 1,
      color: style.color,
    }
  }

  if (group.type === 'ELLIPSE') {
    const start = num(group, '41')
    const end = num(group, '42', Math.PI * 2)
    const points = sampleEllipse(
      num(group, '10'),
      num(group, '20'),
      num(group, '11', 1),
      num(group, '21'),
      num(group, '40', 1),
      start,
      end,
    )
    let sweep = end - start
    if (sweep <= 0) sweep += Math.PI * 2
    return { type: 'polyline', layer: style.layer, points, closed: sweep >= Math.PI * 2 - 0.05, color: style.color, dash: style.dash }
  }

  if (group.type === 'SPLINE') {
    const fitX = nums(group, '11')
    const fitY = nums(group, '21')
    const controlX = nums(group, '10')
    const controlY = nums(group, '20')
    const sourceX = fitX.length > 1 ? fitX : controlX
    const sourceY = fitX.length > 1 ? fitY : controlY
    const points = sourceX.map((x, index) => ({ x, y: sourceY[index] ?? 0 }))
    if (points.length < 2) return null
    const flags = num(group, '70')
    return { type: 'polyline', layer: style.layer, points, closed: (flags & 1) === 1, color: style.color, dash: style.dash }
  }

  if (group.type === 'LWPOLYLINE') {
    const xs = nums(group, '10')
    const ys = nums(group, '20')
    const bulges = nums(group, '42')
    const points = xs.map((x, index) => ({ x, y: ys[index] ?? 0 }))
    const closed = (num(group, '70') & 1) === 1
    const constant = num(group, '43')
    const vertexWidths = group.pairs.filter(([code]) => code === '40' || code === '41').map(([, value]) => Number.parseFloat(value)).filter((value) => value > 0)
    const strokeWidth = constant > 0 ? constant : vertexWidths.length ? vertexWidths.reduce((sum, value) => sum + value, 0) / vertexWidths.length : 0
    return polylineFromVertices(points, bulges, closed, style, strokeWidth)
  }

  if (group.type === 'LEADER') {
    const xs = nums(group, '10')
    const ys = nums(group, '20')
    const points = xs.map((x, index) => ({ x, y: ys[index] ?? 0 }))
    if (points.length < 2) return null
    return { type: 'polyline', layer: style.layer, points, closed: false, color: style.color, dash: style.dash }
  }

  if (group.type === 'HATCH') {
    return hatchEntity(group, style)
  }

  if (group.type === 'DIMENSION') {
    const x1 = num(group, '13')
    const y1 = num(group, '23')
    const x2 = num(group, '14')
    const y2 = num(group, '24')
    const text = str(group, '1')
    const entities: DrawingEntity[] = []
    if (x1 !== x2 || y1 !== y2) {
      entities.push({ type: 'line', layer: style.layer, x1, y1, x2, y2, color: style.color, dash: style.dash })
    }
    if (text) {
      entities.push({
        type: 'text',
        layer: style.layer,
        x: num(group, '11', (x1 + x2) / 2),
        y: num(group, '21', (y1 + y2) / 2),
        text,
        height: 2.5,
        rotation: 0,
        color: style.color,
      })
    }
    return entities[0] ?? null
  }

  return null
}

function hatchEntity(group: Group, style: ReturnType<typeof styleOf>): DrawingEntity | null {
  const solid = num(group, '70') === 1
  const xs: number[] = []
  const ys: number[] = []
  const bulges: number[] = []
  let seenBoundary = false
  group.pairs.forEach(([code, value]) => {
    if (code === '91' || code === '92' || code === '93') seenBoundary = true
    if (!seenBoundary) return
    if (code === '10') xs.push(Number.parseFloat(value))
    if (code === '20') ys.push(Number.parseFloat(value))
    if (code === '42') bulges.push(Number.parseFloat(value))
  })
  const points = xs.map((x, index) => ({ x, y: ys[index] ?? 0 })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  if (points.length < 3) return null
  const sampled = tessellatePolyline(points, bulges, true)
  if (solid) return { type: 'solid', layer: style.layer, points: sampled, color: style.color }
  return { type: 'polyline', layer: style.layer, points: sampled, closed: true, color: style.color, dash: style.dash }
}

type BlockDef = { base: Point2; entities: DrawingEntity[]; inserts: InsertRef[] }
type InsertRef = { name: string; x: number; y: number; sx: number; sy: number; rotation: number; layer: string; color?: string }

function transformPoint(point: Point2, insert: InsertRef, base: Point2): Point2 {
  const x = (point.x - base.x) * insert.sx
  const y = (point.y - base.y) * insert.sy
  const radians = (insert.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: insert.x + x * cos - y * sin,
    y: insert.y + x * sin + y * cos,
  }
}

function placeBlock(name: string, insert: InsertRef, blocks: Map<string, BlockDef>, depth: number, stack: string[]): DrawingEntity[] {
  if (depth > 8 || stack.includes(name)) return []
  const block = blocks.get(name.toUpperCase())
  if (!block) return []
  const placed = block.entities.map((entity) => transformEntity(entity, insert, block.base))
  const nested = block.inserts.flatMap((child) => {
    const origin = transformPoint({ x: child.x, y: child.y }, insert, block.base)
    return placeBlock(child.name, {
      ...child,
      x: origin.x,
      y: origin.y,
      sx: child.sx * insert.sx,
      sy: child.sy * insert.sy,
      rotation: child.rotation + insert.rotation,
    }, blocks, depth + 1, [...stack, name.toUpperCase()])
  })
  return [...placed, ...nested]
}

function transformEntity(entity: DrawingEntity, insert: InsertRef, base: Point2): DrawingEntity {
  const map = (point: Point2) => transformPoint(point, insert, base)
  const color = entity.color ?? insert.color
  if (entity.type === 'line') {
    const a = map({ x: entity.x1, y: entity.y1 })
    const b = map({ x: entity.x2, y: entity.y2 })
    return { ...entity, layer: entity.layer || insert.layer, x1: a.x, y1: a.y, x2: b.x, y2: b.y, color }
  }
  if (entity.type === 'circle' || entity.type === 'arc') {
    const center = map({ x: entity.cx, y: entity.cy })
    const scale = (Math.abs(insert.sx) + Math.abs(insert.sy)) / 2
    return {
      ...entity,
      layer: entity.layer || insert.layer,
      cx: center.x,
      cy: center.y,
      r: entity.r * scale,
      ...(entity.type === 'arc' ? { start: entity.start + insert.rotation, end: entity.end + insert.rotation } : {}),
      color,
    }
  }
  if (entity.type === 'polyline' || entity.type === 'solid') {
    return { ...entity, layer: entity.layer || insert.layer, points: entity.points.map(map), color }
  }
  const anchor = map({ x: entity.x, y: entity.y })
  const scaleY = Math.abs(insert.sy || 1)
  const scaleX = Math.abs(insert.sx || 1)
  return {
    ...entity,
    layer: entity.layer || insert.layer,
    x: anchor.x,
    y: anchor.y,
    rotation: entity.rotation + insert.rotation,
    height: entity.height * scaleY,
    boxWidth: entity.boxWidth ? entity.boxWidth * scaleX : undefined,
    color,
  }
}

function polylineGroup(vertices: Group[], closed: boolean, layers: Map<string, DrawingLayerInfo>, owner: Group): DrawingEntity | null {
  const points = vertices.map((vertex) => ({ x: num(vertex, '10'), y: num(vertex, '20') }))
  const bulges = vertices.map((vertex) => num(vertex, '42'))
  return polylineFromVertices(points, bulges, closed, styleOf(owner, layers))
}

export function parseDxfDocument(text: string): DrawingDocument {
  const groups = groupsFromPairs(pairsFromText(text))
  const layers = new Map<string, DrawingLayerInfo>()
  const styles = new Map<string, TextStyleInfo>()
  const blocks = new Map<string, BlockDef>()
  const model: DrawingEntity[] = []
  const modelInserts: InsertRef[] = []
  let section = ''
  let table = ''
  let currentBlock: { name: string; base: Point2; entities: DrawingEntity[]; inserts: InsertRef[] } | null = null
  let polyOwner: Group | null = null
  let polyVertices: Group[] = []
  let polyClosed = false
  const warnings: string[] = []

  const flushPoly = () => {
    if (!polyOwner) return
    const entity = polylineGroup(polyVertices, polyClosed, layers, polyOwner)
    if (entity) {
      if (currentBlock) currentBlock.entities.push(entity)
      else model.push(entity)
    }
    polyOwner = null
    polyVertices = []
  }

  groups.forEach((group) => {
    if (group.type === 'SECTION') {
      section = str(group, '2').toUpperCase()
      return
    }
    if (group.type === 'ENDSEC') {
      flushPoly()
      section = ''
      table = ''
      return
    }
    if (group.type === 'TABLE') {
      table = str(group, '2').toUpperCase()
      return
    }
    if (group.type === 'ENDTAB') {
      table = ''
      return
    }
    if (group.type === 'STYLE') {
      const name = str(group, '2', 'STANDARD').toUpperCase()
      styles.set(name, { height: num(group, '40'), width: num(group, '41', 1) || 1 })
      return
    }
    if (group.type === 'LAYER' && (section === 'TABLES' || table === 'LAYER')) {
      const name = str(group, '2', '0')
      const flags = num(group, '70')
      layers.set(name, {
        name,
        color: aciColor(Math.abs(num(group, '62', 7)) || 7),
        visible: (flags & 1) === 0 && num(group, '62', 7) >= 0,
      })
      return
    }
    if (group.type === 'BLOCK') {
      flushPoly()
      currentBlock = {
        name: str(group, '2', '*U').toUpperCase(),
        base: { x: num(group, '10'), y: num(group, '20') },
        entities: [],
        inserts: [],
      }
      return
    }
    if (group.type === 'ENDBLK') {
      flushPoly()
      if (currentBlock) blocks.set(currentBlock.name, currentBlock)
      currentBlock = null
      return
    }
    if (group.type === 'VERTEX' && polyOwner) {
      polyVertices.push(group)
      return
    }
    if (group.type === 'SEQEND') {
      flushPoly()
      return
    }
    if (group.type === 'POLYLINE') {
      flushPoly()
      polyOwner = group
      polyClosed = (num(group, '70') & 1) === 1
      polyVertices = []
      return
    }
    if (group.type === 'INSERT') {
      const insert: InsertRef = {
        name: str(group, '2'),
        x: num(group, '10'),
        y: num(group, '20'),
        sx: num(group, '41', 1) || 1,
        sy: num(group, '42', 1) || 1,
        rotation: num(group, '50'),
        layer: str(group, '8', '0') || '0',
        color: styleOf(group, layers).color,
      }
      if (currentBlock) currentBlock.inserts.push(insert)
      else modelInserts.push(insert)
      return
    }
    if (STRUCTURAL.has(group.type)) return

    const entity = entityFromGroup(group, layers, styles)
    if (!entity) {
      if (!['VIEWPORT', 'IMAGE', 'WIPEOUT', 'OLE2FRAME', 'REGION', 'BODY', '3DSOLID', 'ACAD_PROXY_ENTITY'].includes(group.type)) {
        warnings.push(group.type)
      }
      return
    }
    if (currentBlock) currentBlock.entities.push(entity)
    else model.push(entity)
  })
  flushPoly()

  modelInserts.forEach((insert) => {
    const placed = placeBlock(insert.name, insert, blocks, 0, [])
    if (!placed.length) warnings.push(`INSERT ${insert.name}`)
    model.push(...placed)
  })
  const fitted = fitTextEntities(model)
  model.splice(0, model.length, ...fitted)

  if (!layers.size) {
    ;[...new Set(model.map((entity) => entity.layer))].forEach((name) => {
      layers.set(name, { name, color: aciColor(7), visible: true })
    })
  }

  const uniqueWarnings = [...new Set(warnings)].slice(0, 12)
  return {
    format: 'dxf',
    version: 'DXF',
    layers: [...layers.values()],
    layouts: [{ name: 'Model', isModel: true, entities: model }],
    extents: headerExtents(groups),
    warnings: uniqueWarnings.length ? [`Atlanan veya eksik nesneler: ${uniqueWarnings.join(', ')}`] : [],
  }
}

function headerExtents(groups: Group[]) {
  const header = groups.find((group) => group.type === 'SECTION' && group.pairs.some(([code, value]) => code === '2' && value.toUpperCase() === 'HEADER'))
  if (!header) return null
  const read = (name: string) => {
    const start = header.pairs.findIndex(([code, value]) => code === '9' && value.toUpperCase() === name)
    if (start < 0) return null
    let x = Number.NaN
    let y = Number.NaN
    for (let index = start + 1; index < header.pairs.length; index += 1) {
      const [code, value] = header.pairs[index]
      if (code === '9') break
      if (code === '10') x = Number.parseFloat(value)
      if (code === '20') y = Number.parseFloat(value)
    }
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
  }
  const min = read('$EXTMIN')
  const max = read('$EXTMAX')
  if (!min || !max) return null
  return { minX: min.x, minY: min.y, maxX: max.x, maxY: max.y }
}

export function parseDxfEntities(text: string): DrawingEntity[] {
  return parseDxfDocument(text).layouts[0]?.entities ?? []
}
