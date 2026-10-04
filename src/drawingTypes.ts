export type Point2 = { x: number; y: number }

export type DrawingEntity =
  | { type: 'line'; layer: string; x1: number; y1: number; x2: number; y2: number; color?: string; dash?: number[] }
  | { type: 'circle'; layer: string; cx: number; cy: number; r: number; color?: string; dash?: number[] }
  | { type: 'arc'; layer: string; cx: number; cy: number; r: number; start: number; end: number; color?: string; dash?: number[] }
  | { type: 'polyline'; layer: string; points: Point2[]; closed: boolean; color?: string; dash?: number[] }
  | { type: 'text'; layer: string; x: number; y: number; text: string; height: number; rotation: number; color?: string }
  | { type: 'solid'; layer: string; points: Point2[]; color?: string }

export type DrawingLayerInfo = {
  name: string
  color: string
  visible: boolean
}

export type DrawingLayout = {
  name: string
  isModel: boolean
  entities: DrawingEntity[]
}

export type DrawingDocument = {
  format: 'dwg' | 'dxf'
  version: string
  layers: DrawingLayerInfo[]
  layouts: DrawingLayout[]
  warnings: string[]
}
