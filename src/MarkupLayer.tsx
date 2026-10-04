import { VIEW_BOX, worldToViewBox, type DxfTransform } from './dxfTransform'
import type { MediaMarker, NumberMarker, TextNote } from './markupTools'
import type { Point2 } from './measureMath'

function toView(point: Point2, coordMode: 'demo' | 'dxf', transform?: DxfTransform) {
  if (coordMode === 'dxf' && transform) return worldToViewBox(point, transform)
  return point
}

export function MarkupLayer({
  numbers,
  media,
  texts,
  coordMode,
  dxfTransform,
  onSelectMedia,
}: {
  numbers: NumberMarker[]
  media: MediaMarker[]
  texts: TextNote[]
  coordMode: 'demo' | 'dxf'
  dxfTransform?: DxfTransform
  onSelectMedia?: (marker: MediaMarker) => void
}) {
  if (!numbers.length && !media.length && !texts.length) return null
  const viewW = dxfTransform?.viewWidth ?? VIEW_BOX.width
  const viewH = dxfTransform?.viewHeight ?? VIEW_BOX.height

  return (
    <svg className="markup-overlay" viewBox={`0 0 ${viewW} ${viewH}`}>
      {texts.map((note) => {
        const point = toView(note.point, coordMode, dxfTransform)
        const size = Math.max(10, note.height * (dxfTransform?.scale ?? 1))
        return (
          <text key={note.id} className="markup-text" x={point.x} y={point.y} fill={note.color} fontSize={size}>
            {note.text}
          </text>
        )
      })}
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
          <g key={marker.id} onClick={() => onSelectMedia?.(marker)} style={{ cursor: 'pointer' }}>
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
