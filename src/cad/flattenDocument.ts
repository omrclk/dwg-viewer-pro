import type { DrawingDocument, DrawingEntity, DrawingExtents, DrawingLayerInfo, Point2, TextHAlign, TextVAlign } from '../drawingTypes'
import { dashForLineType, orderSolidPoints, rgbCss, sampleEllipse, tessellatePolyline } from './geometry'
import { parseMText, plainMText } from './mtext'

type CadLike = {
  header?: { version?: number; modelSpaceExtMin?: Xyz; modelSpaceExtMax?: Xyz } | null
  layers?: Iterable<LayerLike> | null
  layouts?: Iterable<LayoutLike> | null
  modelSpace?: BlockLike | null
  paperSpace?: BlockLike | null
}

type LayerLike = {
  name?: string
  isOn?: boolean
  layerFlags?: number
  color?: ColorLike
  lineType?: { name?: string } | null
}

type LayoutLike = {
  name?: string
  isPaperSpace?: boolean
  associatedBlock?: BlockLike | null
}

type BlockLike = {
  name?: string
  entities?: Iterable<EntityLike> | null
}

type ColorLike = {
  isByLayer?: boolean
  isByBlock?: boolean
  r?: number
  g?: number
  b?: number
  getRgb?: () => number[]
  index?: number
}

type EntityLike = {
  objectName?: string
  constructor: { name: string }
  layer?: LayerLike
  isInvisible?: boolean
  color?: ColorLike
  getActiveColor?: () => ColorLike
  getActiveLineType?: () => { name?: string }
  startPoint?: Xyz
  endPoint?: Xyz
  center?: Xyz
  radius?: number
  startAngle?: number
  endAngle?: number
  vertices?: Array<{ location?: Xyz; bulge?: number }> | { location?: Xyz; bulge?: number }[]
  isClosed?: boolean
  majorAxisEndPoint?: Xyz
  radiusRatio?: number
  startParameter?: number
  endParameter?: number
  isFullEllipse?: boolean
  polygonalVertexes?: (precision: number) => Xyz[]
  fitPoints?: Xyz[]
  controlPoints?: Xyz[]
  value?: string
  plainText?: string
  insertPoint?: Xyz
  alignmentPoint?: Xyz
  height?: number
  rotation?: number
  widthFactor?: number
  obliqueAngle?: number
  horizontalAlignment?: number
  verticalAlignment?: number
  attachmentPoint?: number
  rectangleWidth?: number
  lineSpacing?: number
  constantWidth?: number
  startWidth?: number
  style?: { height?: number; width?: number; obliqueAngle?: number; lastHeight?: number } | null
  pattern?: { name?: string } | null
  paths?: Array<{ getPoints?: (precision?: number) => Xyz[] }>
  isSolid?: boolean
  explode?: () => Iterable<EntityLike>
  block?: BlockLike | null
  firstCorner?: Xyz
  secondCorner?: Xyz
  thirdCorner?: Xyz
  fourthCorner?: Xyz
  location?: Xyz
  firstPoint?: Xyz
  secondPoint?: Xyz
  measurement?: number
  text?: string
  textMiddlePoint?: Xyz
  normal?: Xyz
}

type Xyz = { x: number; y: number; z?: number }

const VERSION_NAMES: Record<number, string> = {
  9: 'R12',
  19: 'R13',
  21: 'R14',
  23: '2000',
  25: '2004',
  27: '2007',
  29: '2010',
  31: '2013',
  33: '2018',
}

const SKIPPED = new Set(['VIEWPORT', 'SEQEND', 'IMAGE', 'WIPEOUT', 'OLE2FRAME', 'UNDERLAY'])

function cssColor(color: ColorLike | undefined, fallback: string) {
  if (!color || color.isByLayer || color.isByBlock) return fallback
  if (typeof color.r === 'number' && typeof color.g === 'number' && typeof color.b === 'number') {
    return rgbCss(color.r, color.g, color.b)
  }
  const rgb = color.getRgb?.()
  if (rgb && rgb.length >= 3) return rgbCss(rgb[0], rgb[1], rgb[2])
  return fallback
}

function layerColor(layer: LayerLike | undefined) {
  return cssColor(layer?.color, '#ffffff')
}

function entityStyle(entity: EntityLike) {
  const layerName = entity.layer?.name || '0'
  const fallback = layerColor(entity.layer)
  let color = fallback
  try {
    color = cssColor(entity.getActiveColor?.() ?? entity.color, fallback)
  } catch {
    color = fallback
  }
  let dash: number[] | undefined
  try {
    dash = dashForLineType(entity.getActiveLineType?.()?.name ?? entity.layer?.lineType?.name)
  } catch {
    dash = undefined
  }
  return { layer: layerName, color, dash }
}

function xy(point: Xyz | undefined, fallback = 0): Point2 {
  return { x: point?.x ?? fallback, y: point?.y ?? fallback }
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI
}

function positive(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 1e-8 ? value : undefined
}

function resolveTextHeight(entity: EntityLike) {
  return positive(entity.height) ?? positive(entity.style?.height) ?? positive(entity.style?.lastHeight) ?? 2.5
}

function textAlign(horizontal: number, vertical: number): { halign: TextHAlign; valign: TextVAlign } {
  let halign: TextHAlign = 'left'
  let valign: TextVAlign = 'baseline'
  if (horizontal === 1 || horizontal === 4) halign = 'center'
  if (horizontal === 2) halign = 'right'
  if (vertical === 1) valign = 'bottom'
  if (vertical === 2 || horizontal === 4) valign = 'middle'
  if (vertical === 3) valign = 'top'
  return { halign, valign }
}

function mtextAlign(attachment: number): { halign: TextHAlign; valign: TextVAlign } {
  const column = (Math.min(9, Math.max(1, attachment || 1)) - 1) % 3
  const row = Math.floor((Math.min(9, Math.max(1, attachment || 1)) - 1) / 3)
  const halign: TextHAlign = column === 1 ? 'center' : column === 2 ? 'right' : 'left'
  const valign: TextVAlign = row === 0 ? 'top' : row === 1 ? 'middle' : 'bottom'
  return { halign, valign }
}

function polylineWidth(entity: EntityLike) {
  const constant = positive(entity.constantWidth)
  if (constant) return constant
  const vertices = asArray(entity.vertices as Iterable<{ startWidth?: number; endWidth?: number }>)
  const widths = vertices.flatMap((vertex) => [vertex.startWidth ?? 0, vertex.endWidth ?? 0]).filter((value) => value > 1e-8)
  if (widths.length) return widths.reduce((sum, value) => sum + value, 0) / widths.length
  return positive(entity.startWidth)
}

function asArray<T>(value: Iterable<T> | null | undefined): T[] {
  if (!value) return []
  return [...value]
}

function vertexPoints(entity: EntityLike) {
  const vertices = asArray(entity.vertices as Iterable<{ location?: Xyz; bulge?: number }>)
  return {
    points: vertices.map((vertex) => xy(vertex.location)),
    bulges: vertices.map((vertex) => vertex.bulge ?? 0),
  }
}

function flattenEntity(entity: EntityLike, depth: number, stack: string[], warnings: string[]): DrawingEntity[] {
  if (entity.isInvisible) return []
  const name = (entity.objectName || entity.constructor?.name || 'UNKNOWN').toUpperCase()
  if (SKIPPED.has(name)) return []
  const style = entityStyle(entity)

  if (name === 'LINE') {
    return [{
      type: 'line',
      ...style,
      x1: entity.startPoint?.x ?? 0,
      y1: entity.startPoint?.y ?? 0,
      x2: entity.endPoint?.x ?? 0,
      y2: entity.endPoint?.y ?? 0,
    }]
  }

  if (name === 'CIRCLE') {
    return [{
      type: 'circle',
      ...style,
      cx: entity.center?.x ?? 0,
      cy: entity.center?.y ?? 0,
      r: Math.max(0.01, entity.radius ?? 0),
    }]
  }

  if (name === 'ARC') {
    return [{
      type: 'arc',
      ...style,
      cx: entity.center?.x ?? 0,
      cy: entity.center?.y ?? 0,
      r: Math.max(0.01, entity.radius ?? 0),
      start: radiansToDegrees(entity.startAngle ?? 0),
      end: radiansToDegrees(entity.endAngle ?? 0),
    }]
  }

  if (name === 'LWPOLYLINE' || name === 'POLYLINE' || name === 'MLINE') {
    const { points, bulges } = name === 'MLINE'
      ? { points: (entity.vertices as Array<{ location?: Xyz }> | undefined)?.map((vertex) => xy(vertex.location)) ?? [], bulges: [] }
      : vertexPoints(entity)
    if (points.length < 2) return []
    const strokeWidth = polylineWidth(entity)
    return [{
      type: 'polyline',
      ...style,
      points: tessellatePolyline(points, bulges, Boolean(entity.isClosed)),
      closed: Boolean(entity.isClosed),
      ...(strokeWidth ? { strokeWidth } : {}),
    }]
  }

  if (name === 'ELLIPSE') {
    const major = entity.majorAxisEndPoint
    const points = sampleEllipse(
      entity.center?.x ?? 0,
      entity.center?.y ?? 0,
      major?.x ?? 1,
      major?.y ?? 0,
      entity.radiusRatio ?? 1,
      entity.startParameter ?? 0,
      entity.endParameter ?? Math.PI * 2,
    )
    return [{ type: 'polyline', ...style, points, closed: Boolean(entity.isFullEllipse) }]
  }

  if (name === 'SPLINE') {
    let points: Point2[] = []
    try {
      points = (entity.polygonalVertexes?.(16) ?? []).map((point) => xy(point))
    } catch {
      points = []
    }
    if (points.length < 2) {
      const source = entity.fitPoints?.length ? entity.fitPoints : entity.controlPoints
      points = (source ?? []).map((point) => xy(point))
    }
    if (points.length < 2) return []
    return [{ type: 'polyline', ...style, points, closed: Boolean(entity.isClosed) }]
  }

  if (name === 'TEXT' || name === 'ATTDEF' || name === 'ATTRIB') {
    const lines = parseMText(entity.value ?? '')
    const text = plainMText(entity.value ?? '')
    if (!text) return []
    const horizontal = entity.horizontalAlignment ?? 0
    const vertical = entity.verticalAlignment ?? 0
    const useAlignment = horizontal !== 0 || vertical !== 0
    const anchor = (useAlignment ? entity.alignmentPoint : undefined) ?? entity.insertPoint ?? entity.center
    const align = textAlign(horizontal, vertical)
    const height = resolveTextHeight(entity)
    const widthFactor = positive(entity.widthFactor) ?? positive(entity.style?.width) ?? 1
    const oblique = radiansToDegrees(entity.obliqueAngle ?? entity.style?.obliqueAngle ?? 0)
    return [{
      type: 'text',
      ...style,
      x: anchor?.x ?? 0,
      y: anchor?.y ?? 0,
      text,
      lines,
      height,
      rotation: radiansToDegrees(entity.rotation ?? 0),
      widthFactor,
      oblique,
      halign: align.halign,
      valign: align.valign,
      lineSpacing: 1,
    }]
  }

  if (name === 'MTEXT') {
    const lines = parseMText(entity.value || entity.plainText || '')
    const text = plainMText(entity.value || entity.plainText || '')
    if (!text) return []
    const anchor = entity.insertPoint
    const align = mtextAlign(entity.attachmentPoint ?? 1)
    const height = resolveTextHeight(entity)
    const boxWidth = positive(entity.rectangleWidth)
    return [{
      type: 'text',
      ...style,
      x: anchor?.x ?? 0,
      y: anchor?.y ?? 0,
      text,
      lines,
      height,
      rotation: radiansToDegrees(entity.rotation ?? 0),
      widthFactor: positive(entity.style?.width) ?? 1,
      oblique: radiansToDegrees(entity.style?.obliqueAngle ?? 0),
      halign: align.halign,
      valign: align.valign,
      ...(boxWidth ? { boxWidth } : {}),
      lineSpacing: positive(entity.lineSpacing) ?? 1,
    }]
  }

  if (name === 'POINT') {
    return [{
      type: 'circle',
      ...style,
      cx: entity.location?.x ?? 0,
      cy: entity.location?.y ?? 0,
      r: 0.35,
    }]
  }

  if (name === 'SOLID' || name === 'TRACE' || name === '3DFACE') {
    const points = [entity.firstCorner, entity.secondCorner, entity.thirdCorner, entity.fourthCorner]
      .filter((point): point is Xyz => Boolean(point))
      .map((point) => xy(point))
    if (points.length < 3) return []
    return [{ type: 'solid', layer: style.layer, color: style.color, points: orderSolidPoints(points) }]
  }

  if (name === 'HATCH') {
    const patternName = entity.pattern?.name?.toUpperCase() ?? ''
    const solidFill = Boolean(entity.isSolid) || patternName === 'SOLID'
    const outlines = (entity.paths ?? []).flatMap((path) => {
      try {
        return [((path.getPoints?.(16) ?? []).map((point) => xy(point)))]
      } catch {
        return []
      }
    }).filter((points) => points.length >= 3)
    const solids: DrawingEntity[] = solidFill
      ? outlines.map((points) => ({ type: 'solid' as const, layer: style.layer, color: style.color, points }))
      : outlines.map((points) => ({ type: 'polyline' as const, ...style, points, closed: true }))
    let pattern: DrawingEntity[] = []
    if (!entity.isSolid && entity.explode) {
      try {
        pattern = asArray(entity.explode()).flatMap((child) => flattenEntity(child, depth + 1, stack, warnings))
      } catch {
        pattern = []
      }
    }
    return [...solids, ...pattern]
  }

  if (name === 'INSERT') {
    const blockName = entity.block?.name || ''
    if (!blockName || depth > 8 || stack.includes(blockName)) return []
    let children: EntityLike[] = []
    try {
      children = asArray(entity.explode?.() ?? [])
    } catch {
      children = asArray(entity.block?.entities)
    }
    return children.flatMap((child) => flattenEntity(child, depth + 1, [...stack, blockName], warnings))
  }

  if (name === 'LEADER' || name === 'MULTILEADER') {
    const points = (entity.vertices as Xyz[] | undefined)?.map((point) => xy(point)) ?? []
    if (points.length < 2) return []
    return [{ type: 'polyline', ...style, points, closed: false }]
  }

  if (name === 'DIMENSION') {
    const blockEntities = asArray(entity.block?.entities)
    const drawn = blockEntities
      .filter((child) => !['POINT', 'SEQEND'].includes((child.objectName || '').toUpperCase()))
      .flatMap((child) => flattenEntity(child, depth + 1, stack, warnings))
    if (drawn.length) return drawn
    const synthetic: DrawingEntity[] = []
    if (entity.firstPoint && entity.secondPoint) {
      synthetic.push({
        type: 'line',
        ...style,
        x1: entity.firstPoint.x,
        y1: entity.firstPoint.y,
        x2: entity.secondPoint.x,
        y2: entity.secondPoint.y,
      })
      const label = entity.text || (Number.isFinite(entity.measurement) ? String(Math.round((entity.measurement ?? 0) * 1000) / 1000) : '')
      if (label) {
        synthetic.push({
          type: 'text',
          layer: style.layer,
          color: style.color,
          x: entity.textMiddlePoint?.x ?? (entity.firstPoint.x + entity.secondPoint.x) / 2,
          y: entity.textMiddlePoint?.y ?? (entity.firstPoint.y + entity.secondPoint.y) / 2,
          text: label,
          height: 2.5,
          rotation: 0,
        })
      }
    }
    return synthetic
  }

  warnings.push(name)
  return []
}

function layerInfo(layer: LayerLike): DrawingLayerInfo {
  const frozen = ((layer.layerFlags ?? 0) & 1) === 1
  return {
    name: layer.name || '0',
    color: layerColor(layer),
    visible: layer.isOn !== false && !frozen,
  }
}

function layoutsOf(doc: CadLike) {
  const found: Array<{ name: string; isModel: boolean; block: BlockLike }> = []
  asArray(doc.layouts).forEach((layout, index) => {
    const block = layout.associatedBlock
    if (!block) return
    found.push({
      name: layout.name || block.name || (layout.isPaperSpace ? `Layout ${index}` : 'Model'),
      isModel: !layout.isPaperSpace,
      block,
    })
  })
  if (!found.length && doc.modelSpace) {
    found.push({ name: 'Model', isModel: true, block: doc.modelSpace })
  }
  if (doc.paperSpace && doc.paperSpace !== doc.modelSpace) {
    const count = asArray(doc.paperSpace.entities).length
    if (count > 0 && !found.some((layout) => layout.block === doc.paperSpace)) {
      found.push({ name: doc.paperSpace.name || 'Paper', isModel: false, block: doc.paperSpace })
    }
  }
  return found
}

export function flattenCadDocument(doc: CadLike, format: 'dwg' | 'dxf'): DrawingDocument {
  const warnings: string[] = []
  const layers = asArray(doc.layers).map(layerInfo)
  const layouts = layoutsOf(doc).map((layout) => {
    const entities = asArray(layout.block.entities).flatMap((entity) => flattenEntity(entity, 0, [], warnings))
    return { name: layout.name, isModel: layout.isModel, entities }
  })
  if (!layouts.length) {
    layouts.push({ name: 'Model', isModel: true, entities: [] })
  }
  const unique = [...new Set(warnings)].slice(0, 16)
  const versionCode = doc.header?.version ?? -1
  const min = doc.header?.modelSpaceExtMin
  const max = doc.header?.modelSpaceExtMax
  const extents: DrawingExtents | null = min && max
    ? { minX: min.x, minY: min.y, maxX: max.x, maxY: max.y }
    : null
  return {
    format,
    version: VERSION_NAMES[versionCode] ?? (format === 'dxf' ? 'DXF' : `DWG ${versionCode}`),
    layers: layers.length ? layers : [{ name: '0', color: '#ffffff', visible: true }],
    layouts,
    extents,
    warnings: unique.length ? [`Bazi nesneler cizilemedi: ${unique.join(', ')}`] : [],
  }
}
