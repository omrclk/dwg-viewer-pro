import { VIEW_BOX, worldToViewBox, type buildDxfTransform } from './dxfTransform'
import type { MediaMarker, NumberMarker } from './markupTools'
import type { Point2 } from './measureMath'

type DxfTransform = ReturnType<typeof buildDxfTransform>

function toView(point: Point2, coordMode: 'demo' | 'dxf', transform?: DxfTransform) {
  if (coordMode === 'dxf' && transform) return worldToViewBox(point, transform)
  return point
}

export function MarkupLayer({
  numbers,
  media,
  coordMode,
  dxfTransform,
}: {
  numbers: NumberMarker[]
  media: MediaMarker[]
  coordMode: 'demo' | 'dxf'
  dxfTransform?: DxfTransform
}) {
  if (!numbers.length && !media.length) return null

  return (
    <svg className="markup-overlay" viewBox={`0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`} aria-hidden="true">
      {numbers.map((marker) => {
        const point = toView(marker.point, coordMode, dxfTransform)
        return (
          <g key={marker.id}>
            <circle className="markup-number-ring" cx={point.x} cy={point.y} r={12} fill={marker.color} />
            <text className="markup-number-text" x={point.x} y={point.y + 4} textAnchor="middle">
              {marker.number}
            </text>
          </g>
        )
      })}
      {media.map((marker) => {
        const point = toView(marker.point, coordMode, dxfTransform)
        const label = marker.kind === 'image' ? 'IMG' : marker.kind === 'audio' ? 'SES' : 'VID'
        return (
          <g key={marker.id}>
            {marker.imageUrl ? (
              <image href={marker.imageUrl} x={point.x - 24} y={point.y - 24} width={48} height={48} />
            ) : (
              <>
                <rect className="markup-media-box" x={point.x - 18} y={point.y - 12} width={36} height={24} />
                <text className="markup-media-text" x={point.x} y={point.y + 4} textAnchor="middle">
                  {label}
                </text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}
