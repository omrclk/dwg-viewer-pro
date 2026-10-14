import type { Point2 } from './measureMath'
import { VIEW_BOX, worldToViewBox, type buildDxfTransform } from './dxfTransform'
import {
  arcPathFromThreePoints,
  arrowHeadPoints,
  rectFromCorners,
  type SketchShape,
} from './drawTools'
import { distance } from './measureMath'

type DxfTransform = ReturnType<typeof buildDxfTransform>

function toView(point: Point2, coordMode: 'demo' | 'dxf', transform?: DxfTransform) {
  if (coordMode === 'dxf' && transform) return worldToViewBox(point, transform)
  return point
}

function renderShape(shape: SketchShape, coordMode: 'demo' | 'dxf', dxfTransform?: DxfTransform) {
  const pts = shape.points.map((point) => toView(point, coordMode, dxfTransform))
  const stroke = shape.color
  const width = shape.strokeWidth && shape.strokeWidth > 0 ? shape.strokeWidth : 2
  const key = shape.id

  if (shape.kind === 'line' && pts.length >= 2) {
    return (
      <line
        key={key}
        className="sketch-line"
        x1={pts[0].x}
        y1={pts[0].y}
        x2={pts[1].x}
        y2={pts[1].y}
        stroke={stroke} strokeWidth={width}
      />
    )
  }

  if (shape.kind === 'circle' && pts.length >= 2) {
    const radius = distance(pts[0], pts[1])
    return <circle key={key} className="sketch-line" cx={pts[0].x} cy={pts[0].y} r={radius} stroke={stroke} strokeWidth={width} fill="none" />
  }

  if (shape.kind === 'rect' && pts.length >= 2) {
    const box = rectFromCorners(pts[0], pts[1])
    if (shape.chamferSize) {
      const c = shape.chamferSize
      const x = box.x
      const y = box.y
      const w = box.width
      const h = box.height
      const points = `${x + c},${y} ${x + w - c},${y} ${x + w},${y + c} ${x + w},${y + h - c} ${x + w - c},${y + h} ${x + c},${y + h} ${x},${y + h - c} ${x},${y + c}`
      return <polygon key={key} className="sketch-line" points={points} stroke={stroke} strokeWidth={width} fill="none" />
    }
    return (
      <rect
        key={key}
        className="sketch-line"
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        rx={shape.cornerRadius ?? 0}
        ry={shape.cornerRadius ?? 0}
        stroke={stroke} strokeWidth={width}
        fill="none"
      />
    )
  }

  if (shape.kind === 'ellipse' && pts.length >= 2) {
    const box = rectFromCorners(pts[0], pts[1])
    return (
      <ellipse
        key={key}
        className="sketch-line"
        cx={box.x + box.width / 2}
        cy={box.y + box.height / 2}
        rx={box.width / 2}
        ry={box.height / 2}
        stroke={stroke} strokeWidth={width}
        fill="none"
      />
    )
  }

  if (shape.kind === 'arrow' && pts.length >= 2) {
    return (
      <g key={key}>
        <line className="sketch-line" x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke={stroke} strokeWidth={width} />
        <polygon className="sketch-line sketch-fill" points={arrowHeadPoints(pts[0], pts[1])} fill={stroke} stroke={stroke} strokeWidth={width} />
      </g>
    )
  }

  if (shape.kind === 'arc' && pts.length >= 3) {
    return <path key={key} className="sketch-line" d={arcPathFromThreePoints(pts[0], pts[1], pts[2])} stroke={stroke} strokeWidth={width} fill="none" />
  }

  if ((shape.kind === 'polyline' || shape.kind === 'sketch' || shape.kind === 'revcloud') && pts.length >= 2) {
    const points = pts.map((point) => `${point.x},${point.y}`).join(' ')
    return (
      <polyline
        key={key}
        className={shape.kind === 'revcloud' ? 'sketch-line sketch-revcloud' : 'sketch-line'}
        points={points}
        stroke={stroke} strokeWidth={width}
        fill="none"
      />
    )
  }

  if (pts.length === 1) {
    return <circle key={key} className="sketch-line sketch-dot" cx={pts[0].x} cy={pts[0].y} r={4} fill={stroke} />
  }

  return null
}

export function SketchLayer({
  shapes,
  draftShape,
  coordMode,
  dxfTransform,
}: {
  shapes: SketchShape[]
  draftShape: SketchShape | null
  coordMode: 'demo' | 'dxf'
  dxfTransform?: DxfTransform
}) {
  const allShapes = draftShape ? [...shapes, draftShape] : shapes
  if (!allShapes.length) return null

  return (
    <svg className="sketch-overlay" viewBox={`0 0 ${dxfTransform?.viewWidth ?? VIEW_BOX.width} ${dxfTransform?.viewHeight ?? VIEW_BOX.height}`} aria-hidden="true">
      {allShapes.map((shape) => renderShape(shape, coordMode, dxfTransform))}
    </svg>
  )
}
