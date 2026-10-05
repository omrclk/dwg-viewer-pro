import type { DrawingEntity, TextRun } from '../drawingTypes'
import { boundsForEntities, buildDxfTransform, isUsableBounds, worldToViewBox, type Bounds, type DxfTransform } from '../dxfTransform'
import { sampleArc } from './geometry'
import { screenTextSize } from './mtext'

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

function tracePoints(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>, transform: DxfTransform, close: boolean) {
  if (points.length < 2) return
  const first = worldToViewBox(points[0], transform)
  ctx.beginPath()
  ctx.moveTo(first.x, first.y)
  for (let index = 1; index < points.length; index += 1) {
    const point = worldToViewBox(points[index], transform)
    ctx.lineTo(point.x, point.y)
  }
  if (close) ctx.closePath()
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
  viewScale: number,
) {
  const raster = entity.height * transform.scale
  const onScreen = screenTextSize(entity.height, transform.scale * viewScale)
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
    viewScale?: number
  },
) {
  const { entities, hiddenLayers, width, height, viewWidth, viewHeight, theme } = options
  const viewScale = options.viewScale && options.viewScale > 0 ? options.viewScale : 1
  const visible = entities.filter((entity) => !hiddenLayers.has(entity.layer))
  const bounds = isUsableBounds(options.bounds) ? options.bounds : boundsForEntities(visible.length ? visible : entities)
  const transform = buildDxfTransform(bounds, viewWidth, viewHeight)
  const background = theme === 'light' ? '#f6f3ec' : '#0b0d0d'

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)

  const scaleX = width / Math.max(1, viewWidth)
  const scaleY = height / Math.max(1, viewHeight)
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0)
  ctx.lineWidth = 1.15
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const strokeCap = Math.min(viewWidth, viewHeight) * 0.06

  const drawGeometry = (entity: DrawingEntity) => {
    const color = strokeColor(entity.color, theme)
    ctx.strokeStyle = color
    ctx.fillStyle = color
    const dash = 'dash' in entity && entity.dash ? entity.dash.map((part) => part * transform.scale) : []
    ctx.setLineDash(dash)

    if (entity.type === 'line') {
      tracePoints(ctx, [{ x: entity.x1, y: entity.y1 }, { x: entity.x2, y: entity.y2 }], transform, false)
      ctx.stroke()
      return
    }

    if (entity.type === 'circle') {
      const center = worldToViewBox({ x: entity.cx, y: entity.cy }, transform)
      ctx.beginPath()
      ctx.arc(center.x, center.y, Math.max(0.4, entity.r * transform.scale), 0, Math.PI * 2)
      ctx.stroke()
      return
    }

    if (entity.type === 'arc') {
      tracePoints(ctx, sampleArc(entity.cx, entity.cy, entity.r, entity.start, entity.end, 28), transform, false)
      ctx.stroke()
      return
    }

    if (entity.type === 'polyline') {
      const worldWidth = entity.strokeWidth && entity.strokeWidth > 0 ? entity.strokeWidth * transform.scale : 1.15
      ctx.lineWidth = Math.max(0.75, Math.min(worldWidth, strokeCap))
      tracePoints(ctx, entity.points, transform, entity.closed)
      ctx.stroke()
      ctx.lineWidth = 1.15
      return
    }

    if (entity.type === 'solid') {
      tracePoints(ctx, entity.points, transform, true)
      ctx.globalAlpha = theme === 'light' ? 0.28 : 0.35
      ctx.fill('evenodd')
      ctx.globalAlpha = 1
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.lineWidth = 1.15
    }
  }

  visible.forEach((entity) => {
    if (entity.type !== 'text') drawGeometry(entity)
  })
  ctx.setLineDash([])
  visible.forEach((entity) => {
    if (entity.type === 'text' && entity.text) drawCadText(ctx, entity, transform, strokeColor(entity.color, theme), viewScale)
  })

  ctx.setLineDash([])
  return transform
}
