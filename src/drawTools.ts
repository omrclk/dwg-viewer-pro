import type { Point2 } from './measureMath'
import { distance } from './measureMath'

export type DrawTool =
  | 'sketch'
  | 'polyline'
  | 'line'
  | 'circle'
  | 'rect'
  | 'ellipse'
  | 'arc'
  | 'arrow'
  | 'revcloud'

export type SketchShape = {
  id: string
  kind: DrawTool
  color: string
  points: Point2[]
  cornerRadius?: number
  chamferSize?: number
}

const ACTION_TOOL_MAP: Record<string, DrawTool> = {
  'ann-sketch': 'sketch',
  'draw-sketch': 'sketch',
  'draw-polyline': 'polyline',
  'draw-line': 'line',
  'ann-line': 'line',
  'draw-circle': 'circle',
  'draw-rect': 'rect',
  'ann-rect': 'rect',
  'draw-ellipse': 'ellipse',
  'ann-ellipse': 'ellipse',
  'draw-arc': 'arc',
  'ann-arrow': 'arrow',
  'ann-leader': 'arrow',
  'draw-multileader': 'arrow',
  'ann-revcloud': 'revcloud',
  'draw-revcloud': 'revcloud',
}

export const DRAW_LABELS: Record<DrawTool, string> = {
  sketch: 'Eskiz',
  polyline: 'Polyline',
  line: 'Cizgi',
  circle: 'Daire',
  rect: 'Dikdortgen',
  ellipse: 'Elips',
  arc: 'Yay',
  arrow: 'Ok',
  revcloud: 'Revcloud',
}

export const DRAW_HINTS: Record<DrawTool, string> = {
  sketch: 'Eskiz: parmaginla serbest ciz',
  polyline: 'Polyline: nokta sec, bitirmek icin cift dokun',
  line: 'Cizgi: baslangic ve bitis noktasina surukle',
  circle: 'Daire: merkezden disa surukle',
  rect: 'Dikdortgen: bir koseden karsi koseye surukle',
  ellipse: 'Elips: sinirlayici kutuya surukle',
  arc: 'Yay: merkez, baslangic ve bitis noktasi sec',
  arrow: 'Ok: baslangic ve hedefe surukle',
  revcloud: 'Revcloud: sinir boyunca surukle',
}

export function actionIdToDrawTool(actionId: string): DrawTool | null {
  return ACTION_TOOL_MAP[actionId] ?? null
}

export function isDragDrawTool(kind: DrawTool) {
  return kind === 'line' || kind === 'circle' || kind === 'rect' || kind === 'ellipse' || kind === 'arrow'
}

export function isFreehandDrawTool(kind: DrawTool) {
  return kind === 'sketch' || kind === 'revcloud'
}

export function isTapDrawTool(kind: DrawTool) {
  return kind === 'polyline' || kind === 'arc'
}

export function requiredDrawPoints(kind: DrawTool) {
  if (isDragDrawTool(kind)) return 2
  if (kind === 'arc') return 3
  if (kind === 'polyline') return 2
  return 2
}

export function canFinalizeDrawShape(kind: DrawTool, points: Point2[]) {
  if (isFreehandDrawTool(kind)) return points.length >= 2
  if (kind === 'polyline') return points.length >= 2
  return points.length >= requiredDrawPoints(kind)
}

export function rectFromCorners(a: Point2, b: Point2) {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  }
}

export function arcPathFromThreePoints(center: Point2, start: Point2, end: Point2) {
  const radius = distance(center, start)
  if (!radius) return ''
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x)
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x)
  let sweep = endAngle - startAngle
  if (sweep <= 0) sweep += Math.PI * 2
  const largeArc = sweep > Math.PI ? 1 : 0
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

export function arrowHeadPoints(start: Point2, end: Point2, size = 12) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  const left = {
    x: end.x - size * Math.cos(angle - Math.PI / 6),
    y: end.y - size * Math.sin(angle - Math.PI / 6),
  }
  const right = {
    x: end.x - size * Math.cos(angle + Math.PI / 6),
    y: end.y - size * Math.sin(angle + Math.PI / 6),
  }
  return `${end.x},${end.y} ${left.x},${left.y} ${right.x},${right.y}`
}
