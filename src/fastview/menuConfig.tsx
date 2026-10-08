import type { FvIconComponent } from './toolIcons'
import {
  FvArrow,
  FvChamfer,
  FvCircle,
  FvDimAligned,
  FvDimLinear,
  FvEllipse,
  FvExtend,
  FvFillet,
  FvLayerAllOn,
  FvLayerIsolate,
  FvLayerList,
  FvLayerOff,
  FvLayerPlus,
  FvLayerStack,
  FvLeader,
  FvLine,
  FvNavAnnotation,
  FvNavColor,
  FvNavDimension,
  FvNavDraw,
  FvNavEdit,
  FvNavLayer,
  FvNavMeasure,
  FvOffset,
  FvPolyline,
  FvRect,
  FvRevcloud,
  FvRulerAngle,
  FvRulerArea,
  FvRulerDistance,
  FvRulerPoint,
  FvSketch,
  FvText,
  FvTrim,
  FvArc,
} from './toolIcons'

export type MainCategory = 'annotation' | 'draw' | 'edit' | 'layer' | 'measure' | 'dimension' | 'color'

export type SubMenuItem = {
  id: string
  label: string
  icon: FvIconComponent
  vip?: boolean
}

export type CategoryConfig = {
  id: MainCategory
  label: string
  icon: FvIconComponent
  columns: number
}

export const MAIN_CATEGORIES: CategoryConfig[] = [
  { id: 'annotation', label: 'Ek açıklama', icon: FvNavAnnotation, columns: 6 },
  { id: 'draw', label: 'Çiz', icon: FvNavDraw, columns: 6 },
  { id: 'edit', label: 'Düzenle', icon: FvNavEdit, columns: 5 },
  { id: 'layer', label: 'Katman', icon: FvNavLayer, columns: 7 },
  { id: 'measure', label: 'Ölçüm', icon: FvNavMeasure, columns: 6 },
  { id: 'dimension', label: 'Boyut', icon: FvNavDimension, columns: 7 },
  { id: 'color', label: 'Renk', icon: FvNavColor, columns: 0 },
]

export const SUB_MENUS: Record<Exclude<MainCategory, 'color'>, SubMenuItem[]> = {
  annotation: [
    { id: 'ann-sketch', label: 'Taslak, kroki', icon: FvSketch },
    { id: 'ann-arrow', label: 'Ok', icon: FvArrow },
    { id: 'ann-text', label: 'Metin', icon: FvText },
    { id: 'ann-revcloud', label: 'Revizyon bulutu', icon: FvRevcloud, vip: true },
    { id: 'ann-audio', label: 'Ses', icon: FvLeader, vip: true },
    { id: 'ann-image', label: 'Görüntü', icon: FvRect, vip: true },
    { id: 'ann-video', label: 'Video', icon: FvRect, vip: true },
    { id: 'ann-leader', label: 'Gösterge', icon: FvLeader },
    { id: 'ann-line', label: 'Çizgi', icon: FvLine, vip: true },
    { id: 'ann-rect', label: 'Dikdörtgen', icon: FvRect, vip: true },
    { id: 'ann-ellipse', label: 'Elips', icon: FvEllipse, vip: true },
    { id: 'ann-number', label: 'Numara', icon: FvArrow, vip: true },
  ],
  draw: [
    { id: 'draw-polyline', label: 'Çoklu çizgi', icon: FvPolyline },
    { id: 'draw-line', label: 'Çizgi', icon: FvLine },
    { id: 'draw-text', label: 'Metin', icon: FvText },
    { id: 'draw-circle', label: 'Daire', icon: FvCircle },
    { id: 'draw-arc', label: 'Yay', icon: FvArc },
    { id: 'draw-rect', label: 'Dikdörtgen', icon: FvRect },
    { id: 'draw-ellipse', label: 'Elips', icon: FvEllipse },
    { id: 'draw-sketch', label: 'Eskiz', icon: FvSketch },
    { id: 'draw-smartpen', label: 'Serbest çiz', icon: FvSketch, vip: true },
    { id: 'draw-multileader', label: 'Gösterge oku', icon: FvLeader, vip: true },
    { id: 'draw-revcloud', label: 'Revizyon bulutu', icon: FvRevcloud, vip: true },
  ],
  edit: [
    { id: 'edit-trim', label: 'Kırp', icon: FvTrim, vip: true },
    { id: 'edit-extend', label: 'Uzat', icon: FvExtend, vip: true },
    { id: 'edit-offset', label: 'Ötele', icon: FvOffset, vip: true },
    { id: 'edit-fillet', label: 'Yuvarla', icon: FvFillet, vip: true },
    { id: 'edit-chamfer', label: 'Pah', icon: FvChamfer, vip: true },
  ],
  layer: [
    { id: 'layer-new', label: 'Yeni katman', icon: FvLayerPlus, vip: true },
    { id: 'layer-list', label: 'Katman Listesi', icon: FvLayerList },
    { id: 'layer-off', label: 'Katmanı Kapat', icon: FvLayerOff },
    { id: 'layer-isolate', label: 'Diğerlerini kapat', icon: FvLayerIsolate, vip: true },
    { id: 'layer-previous', label: 'Önceki katman', icon: FvLayerStack, vip: true },
    { id: 'layer-all-on', label: 'Tüm katmanları aç', icon: FvLayerAllOn },
    { id: 'layer-default', label: 'Varsayılan katman', icon: FvLayerList, vip: true },
  ],
  measure: [
    { id: 'measure-distance', label: 'Mesafe', icon: FvRulerDistance },
    { id: 'measure-continuous', label: 'Sürekli mesafe', icon: FvPolyline, vip: true },
    { id: 'measure-batch', label: 'Toplu mesafe', icon: FvRulerArea, vip: true },
    { id: 'measure-area', label: 'Alan', icon: FvRulerArea },
    { id: 'measure-facade', label: 'Cephe', icon: FvRect, vip: true },
    { id: 'measure-point', label: 'Koordinat', icon: FvRulerPoint },
    { id: 'measure-arc', label: 'Yay uzunluğu', icon: FvArc, vip: true },
    { id: 'measure-entity', label: 'Varlık', icon: FvCircle, vip: true },
    { id: 'measure-angle', label: 'Açı', icon: FvRulerAngle },
    { id: 'measure-scale', label: 'Ölçek', icon: FvRulerDistance },
    { id: 'measure-results', label: 'Sonuç', icon: FvLeader },
    { id: 'measure-count', label: 'Sonuç sayısı', icon: FvLeader, vip: true },
    { id: 'measure-precision', label: 'Hassas', icon: FvRulerDistance, vip: true },
  ],
  dimension: [
    { id: 'dim-aligned', label: 'Hizalı', icon: FvDimAligned, vip: true },
    { id: 'dim-linear', label: 'Doğrusal boyut', icon: FvDimLinear },
    { id: 'dim-angular', label: 'Açı etiketleme', icon: FvRulerAngle, vip: true },
    { id: 'dim-radius', label: 'Yarıçap', icon: FvCircle, vip: true },
    { id: 'dim-diameter', label: 'Çap Ölçüsü', icon: FvCircle, vip: true },
    { id: 'dim-arclength', label: 'Yay Boyu Ölçüsü', icon: FvArc, vip: true },
    { id: 'dim-3point-arc', label: '3 noktalı yay', icon: FvArc, vip: true },
  ],
}

export const ACI_COLORS = [
  '#ff0000',
  '#ffff00',
  '#00ff00',
  '#00ffff',
  '#0000ff',
  '#ff00ff',
  '#ffffff',
  '#808080',
  '#c0c0c0',
  '#ff8080',
  '#ffbf80',
  '#ffff80',
  '#bfff80',
  '#80ff80',
  '#80ffbf',
  '#80ffff',
  '#80bfff',
  '#8080ff',
  '#bf80ff',
  '#ff80ff',
  '#ff80bf',
  '#404040',
  '#606060',
  '#808080',
  '#a0a0a0',
  '#c0c0c0',
  '#e0e0e0',
  '#18f4ea',
]

export function categoryIndex(category: MainCategory | null) {
  if (!category) return -1
  return MAIN_CATEGORIES.findIndex((item) => item.id === category)
}

export function subMenuColumns(category: Exclude<MainCategory, 'color'>) {
  return MAIN_CATEGORIES.find((item) => item.id === category)?.columns ?? 6
}

export function subMenuRows(category: Exclude<MainCategory, 'color'>) {
  const count = SUB_MENUS[category].length
  const cols = subMenuColumns(category)
  return Math.ceil(count / cols)
}
