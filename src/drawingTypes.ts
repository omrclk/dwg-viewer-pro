export type Point2 = { x: number; y: number }

export type TextHAlign = 'left' | 'center' | 'right'
export type TextVAlign = 'baseline' | 'bottom' | 'middle' | 'top'

/** One formatted span inside a TEXT or MTEXT line. Height is a multiple of the entity height unless absoluteHeight is set. */
export type TextRun = {
  text: string
  heightScale: number
  widthFactor: number
  absoluteHeight?: number
  color?: string
  oblique?: number
}

export type DrawingEntity =
  | { type: 'line'; layer: string; x1: number; y1: number; x2: number; y2: number; color?: string; dash?: number[] }
  | { type: 'circle'; layer: string; cx: number; cy: number; r: number; color?: string; dash?: number[] }
  | { type: 'arc'; layer: string; cx: number; cy: number; r: number; start: number; end: number; color?: string; dash?: number[] }
  | { type: 'polyline'; layer: string; points: Point2[]; closed: boolean; color?: string; dash?: number[]; strokeWidth?: number }
  | {
      type: 'text'
      layer: string
      x: number
      y: number
      text: string
      height: number
      rotation: number
      color?: string
      widthFactor?: number
      oblique?: number
      halign?: TextHAlign
      valign?: TextVAlign
      boxWidth?: number
      lineSpacing?: number
      lines?: TextRun[][]
    }
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

export type DrawingExtents = { minX: number; minY: number; maxX: number; maxY: number }

export type DrawingDocument = {
  format: 'dwg' | 'dxf'
  version: string
  layers: DrawingLayerInfo[]
  layouts: DrawingLayout[]
  warnings: string[]
  /** Header $EXTMIN/$EXTMAX when the file has a usable zoom-extents box. */
  extents?: DrawingExtents | null
}
