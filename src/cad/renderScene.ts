import type { DrawingEntity } from '../drawingTypes'
import { boundsForEntities, buildDxfTransform, worldToViewBox, type DxfTransform } from '../dxfTransform'
import { sampleArc } from './geometry'

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
  },
) {
  const { entities, hiddenLayers, width, height, viewWidth, viewHeight, theme } = options
  const visible = entities.filter((entity) => !hiddenLayers.has(entity.layer))
  const bounds = boundsForEntities(visible.length ? visible : entities)
  const transform = buildDxfTransform(bounds, viewWidth, viewHeight)
  const background = theme === 'light' ? '#f6f3ec' : '#0b0d0d'

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)

  const scaleX = width / Math.max(1, viewWidth)
  const scaleY = height / Math.max(1, viewHeight)
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0)
  ctx.lineWidth = 1.35
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  visible.forEach((entity) => {
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
      tracePoints(ctx, entity.points, transform, entity.closed)
      ctx.stroke()
      return
    }

    if (entity.type === 'solid') {
      tracePoints(ctx, entity.points, transform, true)
      ctx.globalAlpha = theme === 'light' ? 0.28 : 0.35
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.stroke()
      return
    }

    if (entity.type === 'text' && entity.text) {
      const anchor = worldToViewBox({ x: entity.x, y: entity.y }, transform)
      const size = Math.max(8, entity.height * transform.scale)
      ctx.save()
      ctx.translate(anchor.x, anchor.y)
      ctx.rotate((-entity.rotation * Math.PI) / 180)
      ctx.font = `600 ${size}px "Roboto Mono", ui-monospace, sans-serif`
      ctx.textBaseline = 'alphabetic'
      ctx.setLineDash([])
      const lines = entity.text.split('\n')
      lines.forEach((line, index) => {
        ctx.fillText(line, 0, index * size * 1.25)
      })
      ctx.restore()
    }
  })

  ctx.setLineDash([])
  return transform
}
