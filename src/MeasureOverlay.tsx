import { useMemo } from 'react'
import type { Point2 } from './measureMath'
import { worldToViewBox, VIEW_BOX, type buildDxfTransform } from './dxfTransform'
import type { SnapKind } from './settings'
import { snapKindLabel } from './snapEngine'

export type MeasureMode = 'distance' | 'area' | 'angle' | 'arc' | 'point' | 'calibration' | null

type DxfTransform = ReturnType<typeof buildDxfTransform>

function toViewPoint(point: Point2, coordMode: 'demo' | 'dxf', transform?: DxfTransform): Point2 {
  if (coordMode === 'dxf' && transform) return worldToViewBox(point, transform)
  return point
}

function pointsToPolyline(points: Point2[]) {
  return points.map((point) => `${point.x},${point.y}`).join(' ')
}

export function MeasureOverlay({
  mode,
  draftPoints,
  snapPreview,
  coordMode,
  dxfTransform,
  hint,
}: {
  mode: MeasureMode
  draftPoints: Point2[]
  snapPreview: { point: Point2; kind: SnapKind } | null
  coordMode: 'demo' | 'dxf'
  dxfTransform?: DxfTransform
  hint: string
}) {
  const viewPoints = useMemo(
    () => draftPoints.map((point) => toViewPoint(point, coordMode, dxfTransform)),
    [coordMode, dxfTransform, draftPoints],
  )
  const snapView = useMemo(
    () => (snapPreview ? toViewPoint(snapPreview.point, coordMode, dxfTransform) : null),
    [coordMode, dxfTransform, snapPreview],
  )

  if (!mode) return null

  const requiredPoints =
    mode === 'distance' || mode === 'calibration'
      ? 2
      : mode === 'point'
        ? 1
        : mode === 'angle' || mode === 'arc'
          ? 3
          : 99

  const arcPath =
    mode === 'arc' && viewPoints.length === 3
      ? (() => {
          const [center, start, end] = viewPoints
          const radius = Math.hypot(start.x - center.x, start.y - center.y)
          return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`
        })()
      : ''

  return (
    <div className="measure-overlay" aria-live="polite">
      <div className="measure-hint">{hint}</div>
      <svg className="measure-svg" viewBox={`0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`} aria-hidden>
        {viewPoints.length > 1 && mode !== 'point' && (
          <polyline className="measure-draft-line" points={pointsToPolyline(viewPoints)} />
        )}
        {mode === 'area' && viewPoints.length > 2 && (
          <polygon className="measure-draft-fill" points={pointsToPolyline(viewPoints)} />
        )}
        {mode === 'angle' && viewPoints.length === 3 && (
          <>
            <line className="measure-draft-line" x1={viewPoints[0].x} y1={viewPoints[0].y} x2={viewPoints[1].x} y2={viewPoints[1].y} />
            <line className="measure-draft-line" x1={viewPoints[1].x} y1={viewPoints[1].y} x2={viewPoints[2].x} y2={viewPoints[2].y} />
          </>
        )}
        {mode === 'arc' && viewPoints.length === 3 && (
          <>
            <line className="measure-draft-line measure-draft-guide" x1={viewPoints[0].x} y1={viewPoints[0].y} x2={viewPoints[1].x} y2={viewPoints[1].y} />
            <line className="measure-draft-line measure-draft-guide" x1={viewPoints[0].x} y1={viewPoints[0].y} x2={viewPoints[2].x} y2={viewPoints[2].y} />
            <path className="measure-draft-arc" d={arcPath} />
          </>
        )}
        {viewPoints.map((point, index) => (
          <g key={`${point.x}-${point.y}-${index}`}>
            <circle className="measure-point" cx={point.x} cy={point.y} r={5} />
            <text className="measure-point-label" x={point.x + 8} y={point.y - 8}>
              {index + 1}
            </text>
          </g>
        ))}
        {snapView && (
          <g className="snap-marker">
            <circle className="snap-ring" cx={snapView.x} cy={snapView.y} r={14} />
            <circle className="snap-dot" cx={snapView.x} cy={snapView.y} r={5} />
            {snapPreview && (
              <text className="snap-label" x={snapView.x + 12} y={snapView.y - 12}>
                {snapKindLabel(snapPreview.kind)}
              </text>
            )}
          </g>
        )}
      </svg>
      <div className="measure-overlay-meta">
        {draftPoints.length}/{mode === 'area' ? '3+' : requiredPoints} nokta
        {mode === 'area' && draftPoints.length >= 3 && <span> · Bitirmek icin cift tikla</span>}
      </div>
    </div>
  )
}
