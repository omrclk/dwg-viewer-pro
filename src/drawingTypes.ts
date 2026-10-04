export type DrawingEntity =
  | { type: 'line'; layer: string; x1: number; y1: number; x2: number; y2: number }
  | { type: 'circle'; layer: string; cx: number; cy: number; r: number }
  | { type: 'arc'; layer: string; cx: number; cy: number; r: number; start: number; end: number }
  | { type: 'polyline'; layer: string; points: Array<{ x: number; y: number }>; closed: boolean }
