import type { DrawingEntity, TextRun } from '../drawingTypes'
import { applyCamera, boundsForEntities, buildDxfTransform, isUsableBounds, worldToViewBox, type Bounds, type DxfTransform, type ViewCamera } from '../dxfTransform'
import { sampleArc } from './geometry'
import { claimHairlineSpan, decimateScreenPoints, hairlineCss, resolveStrokeWidth, snapDevice } from './hairline'
import { screenTextSize } from './mtext'
import { buildSpatialIndex, entityWorldBox, querySpatialIndex, viewWorldBounds, type SpatialIndex } from './spatialIndex'

export type SceneTheme = 'dark' | 'light'

function strokeColor(color: string | undefined, theme: SceneTheme) {
  if (!color) return theme === 'light' ? '#1d2730' : '#d9fff8'
  const normalized = color.trim().toLowerCase()
  if (theme === 'light' && (normalized === '#ffffff' || normalized === '#fff' || normalized === 'rgb(255, 255, 255)')) {
    return '#1a1a1a'
  }
  if (theme === 'dark' && (normalized === '#000000' || normalized === '#000' || normalized === 'rgb(0, 0, 0)')) {
    return '#f3f3f3'
  }
  return color
}

const TEXT_FONT = '"Roboto", "Noto Sans", "Segoe UI", sans-serif'

function runSize(run: TextRun, baseHeight: number, basePixels: number) {
  if (run.absoluteHeight && run.absoluteHeight > 0 && baseHeight > 0) return basePixels * (run.absoluteHeight / baseHeight)
  return basePixels * (run.heightScale > 0 ? run.heightScale : 1)
}

function drawCadText(
  ctx: CanvasRenderingContext2D,
  entity: Extract<DrawingEntity, { type: 'text' }>,
  transform: DxfTransform,
  color: string,
) {
  const raster = entity.height * transform.scale
  const onScreen = screenTextSize(entity.height, transform.scale)
  if (!(raster > 0) || onScreen === 0) return

  const source = entity.lines?.length
    ? entity.lines
    : entity.text.split('\n').map((line) => [{ text: line, heightScale: 1, widthFactor: 1 } satisfies TextRun])
  const widthFactor = entity.widthFactor && entity.widthFactor > 0 ? entity.widthFactor : 1
  const maxWidth = entity.boxWidth && entity.boxWidth > 0 ? (entity.boxWidth * transform.scale) / widthFactor : 0
  const fontFor = (size: number) => `${Math.max(size, 0.5)}px ${TEXT_FONT}`
  const wrapped = source.flatMap((runs) => wrapRuns(ctx, runs, maxWidth, entity.height, raster, fontFor))
  if (!wrapped.length) return

  const lineStep = raster * (5 / 3) * (entity.lineSpacing && entity.lineSpacing > 0 ? entity.lineSpacing : 1)
  const block = raster + Math.max(0, wrapped.length - 1) * lineStep
  const valign = entity.valign ?? 'baseline'
  const halign = entity.halign ?? 'left'
  const anchor = worldToViewBox({ x: entity.x, y: entity.y }, transform)
  const oblique = ((entity.oblique ?? 0) * Math.PI) / 180

  ctx.save()
  ctx.translate(anchor.x, anchor.y)
  ctx.rotate((-entity.rotation * Math.PI) / 180)
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = valign === 'baseline' ? 'alphabetic' : 'top'

  wrapped.forEach((runs, index) => {
    let y = index * lineStep
    if (valign === 'top') y = index * lineStep
    else if (valign === 'middle') y = -block / 2 + index * lineStep
    else if (valign === 'bottom') y = -block + raster + index * lineStep
    drawRunLine(ctx, runs, y, halign, raster, entity.height, widthFactor, oblique, color, fontFor)
  })
  ctx.restore()
}

function wrapRuns(
  ctx: CanvasRenderingContext2D,
  runs: TextRun[],
  maxWidth: number,
  baseHeight: number,
  basePixels: number,
  fontFor: (size: number) => string,
) {
  const text = runs.map((run) => run.text).join('')
  if (!text.trim()) return []
  if (!(maxWidth > 4) || runs.length !== 1) return [runs]
  const size = runSize(runs[0], baseHeight, basePixels)
  ctx.font = fontFor(size)
  if (ctx.measureText(text).width <= maxWidth) return [runs]
  const lines = breakText(ctx, text, maxWidth)
  return lines.map((line) => [{ ...runs[0], text: line }])
}

function breakText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/(\s+)/).filter((part) => part.length > 0)
  const lines: string[] = []
  let current = ''
  const pushHard = (token: string) => {
    let chunk = ''
    for (const char of token) {
      const next = chunk + char
      if (chunk && ctx.measureText(next).width > maxWidth) {
        lines.push(chunk)
        chunk = char
      } else chunk = next
    }
    return chunk
  }
  words.forEach((word) => {
    const next = current + word
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current.replace(/\s+$/, ''))
      current = word.trimStart()
      if (ctx.measureText(current).width > maxWidth) current = pushHard(current)
    } else current = next
  })
  if (current.trim()) lines.push(current.replace(/\s+$/, ''))
  return lines.length ? lines : [text]
}

function drawRunLine(
  ctx: CanvasRenderingContext2D,
  runs: TextRun[],
  y: number,
  halign: 'left' | 'center' | 'right',
  basePixels: number,
  baseHeight: number,
  widthFactor: number,
  oblique: number,
  color: string,
  fontFor: (size: number) => string,
) {
  const pieces = runs
    .map((run) => {
      const size = runSize(run, baseHeight, basePixels)
      const factor = widthFactor * (run.widthFactor > 0 ? run.widthFactor : 1)
      return { ...run, size, factor }
    })
    .filter((piece) => piece.text)
  if (!pieces.length) return
  let total = 0
  pieces.forEach((piece) => {
    ctx.font = fontFor(piece.size)
    total += ctx.measureText(piece.text).width * piece.factor
  })
  let x = halign === 'center' ? -total / 2 : halign === 'right' ? -total : 0
  const skew = -Math.tan(oblique)
  pieces.forEach((piece) => {
    ctx.font = fontFor(piece.size)
    ctx.fillStyle = piece.color || color
    const width = ctx.measureText(piece.text).width * piece.factor
    const pieceSkew = -Math.tan(((piece.oblique ?? 0) * Math.PI) / 180)
    ctx.save()
    ctx.translate(x, y)
    ctx.transform(piece.factor, 0, (skew + pieceSkew) * piece.factor, 1, 0, 0)
    ctx.fillText(piece.text, 0, 0)
    ctx.restore()
    x += width
  })
}

type ScreenPoint = { x: number; y: number }
type StrokeOp =
  | { kind: 'poly'; points: ScreenPoint[]; close: boolean }
  | { kind: 'circle'; x: number; y: number; r: number }
type StrokeBucket = { color: string; dash: number[]; width: number; ops: StrokeOp[] }

function toScreen(points: Array<{ x: number; y: number }>, transform: DxfTransform, minDist: number, dpr: number, snap: boolean) {
  const mapped = points.map((point) => worldToViewBox(point, transform))
  const decimated = decimateScreenPoints(mapped, minDist)
  if (!snap) return decimated
  return decimated.map((point) => ({ x: snapDevice(point.x, dpr), y: snapDevice(point.y, dpr) }))
}

function pushSegments(
  bucket: StrokeBucket,
  points: ScreenPoint[],
  close: boolean,
  dpr: number,
  takenRows: Set<number>,
  takenCols: Set<number>,
  cull: boolean,
) {
  if (points.length < 2) return
  const keep = (from: ScreenPoint, to: ScreenPoint) => {
    if (!cull) return true
    const dx = Math.abs(to.x - from.x)
    const dy = Math.abs(to.y - from.y)
    if (dx >= dy * 3 && dx * dpr >= 2) return claimHairlineSpan(takenRows, (from.y + to.y) / 2, from.x, to.x, dpr)
    if (dy >= dx * 3 && dy * dpr >= 2) return claimHairlineSpan(takenCols, (from.x + to.x) / 2, from.y, to.y, dpr)
    return true
  }
  if (!close && points.length === 2) {
    if (keep(points[0], points[1])) bucket.ops.push({ kind: 'poly', points, close: false })
    return
  }
  let current: ScreenPoint[] = [points[0]]
  const flush = () => {
    if (current.length >= 2) bucket.ops.push({ kind: 'poly', points: current, close: false })
  }
  for (let index = 1; index < points.length; index += 1) {
    if (keep(points[index - 1], points[index])) current.push(points[index])
    else {
      flush()
      current = [points[index]]
    }
  }
  if (close && keep(points[points.length - 1], points[0]) && current.length >= 2) {
    current.push(points[0])
  }
  flush()
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  options: {
    entities: DrawingEntity[]
    hiddenLayers: Set<string>
    width: number
    height: number
    viewWidth: number
    viewHeight: number
    theme: SceneTheme
    bounds?: Bounds | null
    camera?: ViewCamera
    showLineweights?: boolean
    dpr?: number
    index?: SpatialIndex
  },
) {
  const { entities, hiddenLayers, width, height, viewWidth, viewHeight, theme } = options
  const showLineweights = options.showLineweights === true
  const visible = entities.filter((entity) => !hiddenLayers.has(entity.layer))
  const bounds = isUsableBounds(options.bounds) ? options.bounds : boundsForEntities(visible.length ? visible : entities)
  const fit = buildDxfTransform(bounds, viewWidth, viewHeight)
  const transform = options.camera ? applyCamera(fit, options.camera) : fit
  const dpr = options.dpr && options.dpr > 0 ? options.dpr : width / Math.max(1, viewWidth)
  const hairline = hairlineCss(dpr)
  const background = theme === 'light' ? '#f6f3ec' : '#0b0d0d'
  const index = options.index ?? (entities.length > 4000 ? buildSpatialIndex(entities) : undefined)
  const view = viewWorldBounds(transform)
  const hits = index ? querySpatialIndex(index, view) : null
  const drawList = hits
    ? hits.flatMap((entityIndex) => {
        const entity = entities[entityIndex]
        return entity && !hiddenLayers.has(entity.layer) ? [entity] : []
      })
    : visible

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)

  const scaleX = width / Math.max(1, viewWidth)
  const scaleY = height / Math.max(1, viewHeight)
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0)
  ctx.lineWidth = hairline
  ctx.lineJoin = 'miter'
  ctx.miterLimit = 2
  ctx.lineCap = 'butt'
  ctx.imageSmoothingEnabled = false

  const strokes = new Map<string, StrokeBucket>()
  const fills: Array<{ color: string; points: ScreenPoint[] }> = []
  const dots: Array<{ color: string; x: number; y: number }> = []
  const takenRows = new Set<number>()
  const takenCols = new Set<number>()
  const dust = 0.35 / dpr
  const dot = 1 / dpr
  const minSep = 0.75 / dpr

  const bucketFor = (color: string, dash: number[], width: number) => {
    const key = `${color}|${width.toFixed(4)}|${dash.join(',')}`
    let bucket = strokes.get(key)
    if (!bucket) {
      bucket = { color, dash, width, ops: [] }
      strokes.set(key, bucket)
    }
    return bucket
  }

  drawList.forEach((entity) => {
    if (entity.type === 'text') return
    const color = strokeColor(entity.color, theme)
    const box = entityWorldBox(entity)
    if (box) {
      const boxWidth = (box.maxX - box.minX) * transform.scale
      const boxHeight = (box.maxY - box.minY) * transform.scale
      if (boxWidth < dust && boxHeight < dust) return
      if (boxWidth <= dot && boxHeight <= dot) {
        const center = worldToViewBox({ x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 }, transform)
        dots.push({ color, x: Math.round(center.x * dpr) / dpr, y: Math.round(center.y * dpr) / dpr })
        return
      }
    }

    const dash = 'dash' in entity && entity.dash ? entity.dash.map((part) => part * transform.scale) : []

    if (entity.type === 'line') {
      const points = toScreen(
        [{ x: entity.x1, y: entity.y1 }, { x: entity.x2, y: entity.y2 }],
        transform,
        minSep,
        dpr,
        true,
      )
      pushSegments(bucketFor(color, dash, hairline), points, false, dpr, takenRows, takenCols, true)
      return
    }

    if (entity.type === 'circle') {
      const radius = entity.r * transform.scale
      if (!(radius > 0)) return
      const center = worldToViewBox({ x: entity.cx, y: entity.cy }, transform)
      if (radius * 2 <= dot) {
        dots.push({ color, x: Math.round(center.x * dpr) / dpr, y: Math.round(center.y * dpr) / dpr })
        return
      }
      const snapped = { x: snapDevice(center.x, dpr), y: snapDevice(center.y, dpr) }
      bucketFor(color, dash, hairline).ops.push({ kind: 'circle', x: snapped.x, y: snapped.y, r: radius })
      return
    }

    if (entity.type === 'arc') {
      const points = toScreen(sampleArc(entity.cx, entity.cy, entity.r, entity.start, entity.end, 28), transform, minSep, dpr, true)
      pushSegments(bucketFor(color, dash, hairline), points, false, dpr, takenRows, takenCols, false)
      return
    }

    if (entity.type === 'polyline') {
      const width = resolveStrokeWidth(showLineweights, entity.strokeWidth, transform.scale, hairline)
      const crisp = width <= hairline * 1.05
      const points = toScreen(entity.points, transform, minSep, dpr, crisp)
      pushSegments(bucketFor(color, dash, width), points, entity.closed, dpr, takenRows, takenCols, crisp)
      return
    }

    if (entity.type === 'solid' && entity.points.length >= 3) {
      fills.push({ color, points: entity.points.map((point) => worldToViewBox(point, transform)) })
    }
  })

  fills.forEach((fill) => {
    if (fill.points.length < 3) return
    ctx.beginPath()
    ctx.moveTo(fill.points[0].x, fill.points[0].y)
    for (let index = 1; index < fill.points.length; index += 1) ctx.lineTo(fill.points[index].x, fill.points[index].y)
    ctx.closePath()
    ctx.fillStyle = fill.color
    ctx.globalAlpha = theme === 'light' ? 0.28 : 0.35
    ctx.fill('evenodd')
    ctx.globalAlpha = 1
  })

  const dotSize = 1 / dpr
  dots.forEach((dotMark) => {
    ctx.fillStyle = dotMark.color
    ctx.fillRect(dotMark.x, dotMark.y, dotSize, dotSize)
  })

  strokes.forEach((bucket) => {
    if (!bucket.ops.length) return
    ctx.beginPath()
    ctx.strokeStyle = bucket.color
    ctx.lineWidth = bucket.width
    ctx.setLineDash(bucket.dash)
    bucket.ops.forEach((op) => {
      if (op.kind === 'circle') {
        ctx.moveTo(op.x + op.r, op.y)
        ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2)
        return
      }
      ctx.moveTo(op.points[0].x, op.points[0].y)
      for (let index = 1; index < op.points.length; index += 1) ctx.lineTo(op.points[index].x, op.points[index].y)
      if (op.close) ctx.closePath()
    })
    ctx.stroke()
  })

  ctx.setLineDash([])
  ctx.lineWidth = hairline
  drawList.forEach((entity) => {
    if (entity.type === 'text' && entity.text) drawCadText(ctx, entity, transform, strokeColor(entity.color, theme))
  })

  return transform
}
