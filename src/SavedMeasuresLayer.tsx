import type { MeasureRecord, Point2 } from './measureMath'
import { worldToViewBox, VIEW_BOX, type buildDxfTransform } from './dxfTransform'

type DxfTransform = ReturnType<typeof buildDxfTransform>

function toView(point: Point2, coordMode: 'demo' | 'dxf', transform?: DxfTransform) {
  if (coordMode === 'dxf' && transform) return worldToViewBox(point, transform)
  return point
}

export function SavedMeasuresLayer({
  records,
  coordMode,
  dxfTransform,
  hidden = false,
}: {
  records: MeasureRecord[]
  coordMode: 'demo' | 'dxf'
  dxfTransform?: DxfTransform
  hidden?: boolean
}) {
  if (!records.length || hidden) return null

  return (
    <svg className="measure-svg measure-saved" viewBox={`0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`} aria-hidden>
      {records.map((record) => {
        const points = record.points.map((point) => toView(point, coordMode, dxfTransform))
        if (points.length < 1) return null

        return (
          <g key={record.id} className="measure-saved-item">
            {record.kind === 'distance' && points.length >= 2 && (
              <line className="measure-saved-line" x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} />
            )}
            {record.kind === 'area' && points.length >= 3 && (
              <polygon className="measure-saved-fill" points={points.map((point) => `${point.x},${point.y}`).join(' ')} />
            )}
            {record.kind === 'angle' && points.length >= 3 && (
              <>
                <line className="measure-saved-line" x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} />
                <line className="measure-saved-line" x1={points[1].x} y1={points[1].y} x2={points[2].x} y2={points[2].y} />
              </>
            )}
            {record.kind === 'arc' && points.length >= 3 && (
              <>
                <line className="measure-saved-guide" x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} />
                <line className="measure-saved-guide" x1={points[0].x} y1={points[0].y} x2={points[2].x} y2={points[2].y} />
              </>
            )}
            {points.map((point, index) => (
              <circle key={index} className="measure-saved-point" cx={point.x} cy={point.y} r={4} />
            ))}
            <text className="measure-saved-label" x={points[0].x + 6} y={points[0].y - 6}>
              {record.displayValue}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
