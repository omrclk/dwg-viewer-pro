import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  ArrowUpToLine,
  Box,
  CircleHelp,
  Ellipsis,
  EyeOff,
  FileText,
  FolderOpen,
  Layers,
  Maximize,
  MessageSquare,
  Palette,
  Pencil,
  Printer,
  Redo2,
  RefreshCw,
  Ruler,
  Save,
  Settings,
  SquarePen,
  Undo2,
  X,
  ZoomIn,
} from 'lucide-react'
import './App.css'
import './fastview/fastview.css'
import { pickFileFromSource, type CloudProvider } from './cloud'
import type { DrawingEntity } from './drawingTypes'
import { buildOpenedFile } from './fileOpenService'
import type { FileSource, OpenedFile, RecentFileEntry } from './fileTypes'
import { formatBytes, sourceLabel } from './fileTypes'
import { OpenFilesPanel } from './OpenFilesPanel'
import { listRecentFiles, loadCachedFile, toggleRecentFavorite } from './recentFiles'
import { applyCamera, boundsForEntities, buildDxfTransform, gestureDelta } from './dxfTransform'
import {
  actionIdToDrawTool,
  canFinalizeDrawShape,
  DRAW_HINTS,
  DRAW_LABELS,
  isDragDrawTool,
  isFreehandDrawTool,
  isTapDrawTool,
  type DrawTool,
  type SketchShape,
} from './drawTools'
import { SketchLayer } from './SketchLayer'
import {
  actionIdToEditTool,
  chamferSketchShape,
  EDIT_HINTS,
  EDIT_LABELS,
  extendSketchShape,
  filletSketchShape,
  findNearestSketchShape,
  offsetSketchShape,
  trimSketchShape,
  type EditTool,
} from './editTools'
import { MarkupLayer } from './MarkupLayer'
import { nextNumber, type MediaMarker, type NumberMarker, type TextNote } from './markupTools'
import { SettingsPanel } from './components/SettingsPanel'
import { buildMeasureRecord, calibrationFactor, canFinalize, requiredPointCount } from './measureActions'
import type { MeasureRecord, Point2 } from './measureMath'
import { distance, downloadTextFile, recordsToCsv } from './measureMath'
import { MeasureOverlay, type MeasureMode } from './MeasureOverlay'
import { MeasureResultsPanel } from './MeasureResultsPanel'
import { SavedMeasuresLayer } from './SavedMeasuresLayer'
import { findNearestEntity } from './entityPick'
import { screenToWorldPoint } from './screenToWorld'
import { DEMO_SNAP_POINTS } from './demoSnapPoints'
import { collectSnapTargets, findNearestSnap, snapToleranceInCoords } from './snapEngine'
import { entityRenderLimit, loadSettings, resolvePerformanceMode, saveSettings, type AppSettings, type SnapKind } from './settings'
import { SnapPanel } from './components/SnapPanel'
import {
  FastViewBottomStack,
  FastViewColorModal,
  FastViewOverflowMenu,
  FastViewTopBar,
} from './components/FastViewMenus'
import { FastViewHome } from './components/FastViewHome'
import type { MainCategory } from './fastview/menuConfig'
import { subMenuRows } from './fastview/menuConfig'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { VIEW_BOX } from './dxfTransform'
import { CadCanvas } from './components/CadCanvas'
import { UpgradeSheet } from './components/UpgradeSheet'
import { FREE_MEASURE_LIMIT } from './billing/products'
import { loadEntitlement, loadProProduct, purchasePro, refreshEntitlement, restorePro as restoreProPurchase } from './billing/entitlement'
import { exportDrawingPdf, exportDrawingPng } from './exportShare'
import { SUB_MENUS } from './fastview/menuConfig'
import { APP_VERSION } from './version'

declare global {
  interface Window {
    DwgNative?: {
      print: () => void
      pullChunk?: (offset: number, length: number) => string
      clearPending?: () => void
    }
    __dwgViewer?: {
      zoomIn: () => void
      zoomOut: () => void
      fit: () => void
    }
  }
}

const VIP_ACTIONS = new Set(
  Object.values(SUB_MENUS).flatMap((items) => items.filter((item) => item.vip).map((item) => item.id)),
)

type ToolbarAction = 'open' | 'save' | 'undo' | 'redo' | 'print' | 'zoomIn' | 'fit'
type MenuAction = 'viewMode' | 'fileInfo' | 'export' | 'help' | 'toggleAnnotations' | 'measureResults' | 'regen' | 'open' | 'settings'
type BottomAction = 'comments' | 'draw' | 'note' | 'layers' | 'measureList' | 'quickMeasure' | 'color'
type ExternalFilePayload = {
  id?: string
  name?: string
  mimeType?: string
  base64?: string
  size?: number
  chunked?: boolean
  sourcePath?: string
  message?: string
}
type CommentRecord = {
  id: string
  text: string
  color: string
  createdAt: string
}
type MeasureSession = 'normal' | 'continuous' | 'batch' | 'entity' | 'radius' | 'diameter'
type MarkupPlaceMode = 'number' | 'image' | 'audio' | 'video' | null

const topTools: Array<{ icon: any; label: string; action: ToolbarAction }> = [
  { icon: FolderOpen, label: 'Open folder', action: 'open' },
  { icon: Save, label: 'Save', action: 'save' },
  { icon: Undo2, label: 'Undo', action: 'undo' },
  { icon: Redo2, label: 'Redo', action: 'redo' },
  { icon: Printer, label: 'Print', action: 'print' },
  { icon: ZoomIn, label: 'Zoom in', action: 'zoomIn' },
  { icon: Maximize, label: 'Fit', action: 'fit' },
]

const MIN_VIEW_SCALE = 0.2
const MAX_VIEW_SCALE = 256
const ZOOM_FACTOR = 1.22

const menuItems: Array<{ icon: any; label: string; action: MenuAction }> = [
  { icon: Box, label: 'Görüntüleme Modu', action: 'viewMode' },
  { icon: FileText, label: 'Dosya Bilgisi', action: 'fileInfo' },
  { icon: ArrowUpToLine, label: 'Dışa aktar', action: 'export' },
  { icon: CircleHelp, label: 'yardım', action: 'help' },
  { icon: EyeOff, label: 'Ek açıklamaları gizle', action: 'toggleAnnotations' },
  { icon: Ruler, label: 'Ölçülen sonucu gizle', action: 'measureResults' },
  { icon: RefreshCw, label: 'Yenile', action: 'regen' },
  { icon: FolderOpen, label: 'Aç', action: 'open' },
  { icon: Settings, label: 'Ayarlar', action: 'settings' },
]

const measureTools: Array<{ id: MeasureMode; label: string; iconClass: string; marker?: boolean }> = [
  { id: 'distance', label: 'Distance', iconClass: 'distance' },
  { id: 'area', label: 'Area', iconClass: 'area' },
  { id: 'angle', label: 'Facade', iconClass: 'facade', marker: true },
  { id: 'point', label: '3D Point', iconClass: 'idpoint', marker: true },
  { id: 'arc', label: 'Arc Length', iconClass: 'arc', marker: true },
]

const bottomTools: Array<{ icon: any; label: string; action: BottomAction }> = [
  { icon: MessageSquare, label: 'Comments', action: 'comments' },
  { icon: Pencil, label: 'Draw', action: 'draw' },
  { icon: SquarePen, label: 'Note', action: 'note' },
  { icon: Layers, label: 'Layers', action: 'layers' },
  { icon: Ruler, label: 'Measure List', action: 'measureList' },
  { icon: Ruler, label: 'Quick Measure', action: 'quickMeasure' },
  { icon: Palette, label: 'Color Palette', action: 'color' },
]

const MARKUP_COLORS = ['#18f4ea', '#ffb020', '#ef4444', '#22c55e', '#a855f7', '#f8fafc']

function layersFromEntities(entities: DrawingEntity[]) {
  return [...new Set(entities.map((entity) => entity.layer))].sort((a, b) => a.localeCompare(b, 'tr'))
}

function countEntitiesByLayer(entities: DrawingEntity[]) {
  const counts = new Map<string, number>()
  entities.forEach((entity) => {
    counts.set(entity.layer, (counts.get(entity.layer) ?? 0) + 1)
  })
  return counts
}

function layerVisibility(hiddenLayers: Set<string>, layer: string) {
  return hiddenLayers.has(layer) ? 'hidden' : 'visible'
}

type ViewportState = { scale: number; panX: number; panY: number }

const MEASURE_HINTS: Record<Exclude<MeasureMode, null>, string> = {
  distance: 'Mesafe icin iki nokta secin',
  area: 'Alan icin kose noktalari secin, bitirmek icin cift tikla',
  angle: 'Aci icin: baslangic, tepe, bitis noktasi',
  arc: 'Yay: merkez, baslangic, bitis noktasi',
  point: 'Koordinat okumak icin nokta secin',
  calibration: 'Kalibrasyon: bilinen mesafenin iki ucunu secin',
}

function clampScale(scale: number) {
  return Math.min(MAX_VIEW_SCALE, Math.max(MIN_VIEW_SCALE, scale))
}

function bytesFromBase64(value: string) {
  const binary = window.atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function fileFromPayload(payload: ExternalFilePayload) {
  if (payload.chunked && window.DwgNative?.pullChunk && payload.size) {
    const parts: Uint8Array[] = []
    const slice = 256 * 1024
    for (let offset = 0; offset < payload.size; offset += slice) {
      const encoded = window.DwgNative.pullChunk(offset, Math.min(slice, payload.size - offset))
      if (!encoded) throw new Error('Dosya parcasi okunamadi.')
      parts.push(bytesFromBase64(encoded))
    }
    window.DwgNative.clearPending?.()
    return new File(parts, payload.name || 'paylasilan-cizim.dwg', {
      type: payload.mimeType || 'application/octet-stream',
    })
  }
  if (!payload.base64) throw new Error('Dosya verisi alinamadi.')
  return new File([bytesFromBase64(payload.base64)], payload.name || 'paylasilan-cizim.dwg', {
    type: payload.mimeType || 'application/octet-stream',
  })
}

function zoomAtPoint(state: ViewportState, factor: number, anchorX: number, anchorY: number): ViewportState {
  const nextScale = clampScale(state.scale * factor)
  const ratio = nextScale / state.scale
  return {
    scale: nextScale,
    panX: anchorX - (anchorX - state.panX) * ratio,
    panY: anchorY - (anchorY - state.panY) * ratio,
  }
}

type ViewportHandle = {
  zoomIn: () => void
  zoomOut: () => void
  fit: () => void
  zoomToScreenRect: (rect: { x1: number; y1: number; x2: number; y2: number }) => void
}

function DrawingViewport({
  children,
  resetKey,
  actionsRef,
  panLocked = false,
  onViewportChange,
}: {
  children: (camera: ViewportState) => ReactNode
  resetKey: string
  actionsRef: React.MutableRefObject<ViewportHandle | null>
  panLocked?: boolean
  onViewportChange?: (state: ViewportState) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [committed, setCommitted] = useState<ViewportState>({ scale: 1, panX: 0, panY: 0 })
  const [gesture, setGesture] = useState<ViewportState | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const committedRef = useRef(committed)
  const gestureRef = useRef<ViewportState | null>(null)
  committedRef.current = committed
  const panSession = useRef<{ pointerId: number; startX: number; startY: number; scale: number; panX: number; panY: number } | null>(null)
  const pinchSession = useRef<{ distance: number; scale: number; panX: number; panY: number } | null>(null)

  const setLive = (next: ViewportState) => {
    gestureRef.current = next
    setGesture(next)
  }

  const commitGesture = () => {
    const live = gestureRef.current
    if (!live) return
    gestureRef.current = null
    setGesture(null)
    setCommitted(live)
  }

  const commitCamera = (next: ViewportState) => {
    gestureRef.current = null
    setGesture(null)
    setCommitted(next)
  }

  const displayedCamera = () => gestureRef.current ?? committedRef.current

  const fitToScreen = useCallback(() => {
    gestureRef.current = null
    setGesture(null)
    setCommitted({ scale: 1, panX: 0, panY: 0 })
  }, [])

  const zoomIn = useCallback(() => {
    const host = hostRef.current
    if (!host) {
      commitCamera({ ...displayedCamera(), scale: clampScale(displayedCamera().scale * ZOOM_FACTOR) })
      return
    }
    const rect = host.getBoundingClientRect()
    commitCamera(zoomAtPoint(displayedCamera(), ZOOM_FACTOR, rect.width / 2, rect.height / 2))
  }, [])

  const zoomOut = useCallback(() => {
    const host = hostRef.current
    if (!host) {
      commitCamera({ ...displayedCamera(), scale: clampScale(displayedCamera().scale / ZOOM_FACTOR) })
      return
    }
    const rect = host.getBoundingClientRect()
    commitCamera(zoomAtPoint(displayedCamera(), 1 / ZOOM_FACTOR, rect.width / 2, rect.height / 2))
  }, [])

  useEffect(() => {
    fitToScreen()
  }, [resetKey, fitToScreen])

  const zoomToScreenRect = useCallback((rect: { x1: number; y1: number; x2: number; y2: number }) => {
    const host = hostRef.current
    if (!host) return
    const hostRect = host.getBoundingClientRect()
    const x1 = Math.min(rect.x1, rect.x2)
    const y1 = Math.min(rect.y1, rect.y2)
    const width = Math.abs(rect.x2 - rect.x1)
    const height = Math.abs(rect.y2 - rect.y1)
    if (width < 12 || height < 12) return
    const current = displayedCamera()
    const factor = Math.min(hostRect.width / width, hostRect.height / height)
    const nextScale = clampScale(current.scale * factor)
    const centerX = x1 + width / 2
    const centerY = y1 + height / 2
    const localX = (centerX - current.panX) / current.scale
    const localY = (centerY - current.panY) / current.scale
    commitCamera({
      scale: nextScale,
      panX: hostRect.width / 2 - localX * nextScale,
      panY: hostRect.height / 2 - localY * nextScale,
    })
  }, [])

  useEffect(() => {
    actionsRef.current = { zoomIn, zoomOut, fit: fitToScreen, zoomToScreenRect }
    return () => {
      actionsRef.current = null
    }
  }, [actionsRef, fitToScreen, zoomIn, zoomOut, zoomToScreenRect])

  useEffect(() => {
    if (gesture) return
    onViewportChange?.(committed)
  }, [committed, gesture, onViewportChange])

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const host = hostRef.current
    if (!host) return
    const rect = host.getBoundingClientRect()
    const anchorX = event.clientX - rect.left
    const anchorY = event.clientY - rect.top
    const factor = event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR
    commitCamera(zoomAtPoint(displayedCamera(), factor, anchorX, anchorY))
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panLocked || event.button !== 0) return
    const host = hostRef.current
    if (!host) return
    host.setPointerCapture(event.pointerId)
    const camera = displayedCamera()
    panSession.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scale: camera.scale,
      panX: camera.panX,
      panY: camera.panY,
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const session = panSession.current
    if (!session || session.pointerId !== event.pointerId) return
    setLive({
      scale: session.scale,
      panX: session.panX + (event.clientX - session.startX),
      panY: session.panY + (event.clientY - session.startY),
    })
  }

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const session = panSession.current
    if (!session || session.pointerId !== event.pointerId) return
    panSession.current = null
    hostRef.current?.releasePointerCapture(event.pointerId)
    commitGesture()
  }

  const touchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.hypot(dx, dy)
  }

  const touchCenter = (touches: React.TouchList, rect: DOMRect) => {
    if (touches.length < 2) return { x: rect.width / 2, y: rect.height / 2 }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
      y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
    }
  }

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) return
    panSession.current = null
    setIsPanning(false)
    const host = hostRef.current
    if (!host) return
    const camera = displayedCamera()
    pinchSession.current = {
      distance: touchDistance(event.touches),
      scale: camera.scale,
      panX: camera.panX,
      panY: camera.panY,
    }
  }

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || !pinchSession.current) return
    event.preventDefault()
    const host = hostRef.current
    if (!host) return
    const rect = host.getBoundingClientRect()
    const distance = touchDistance(event.touches)
    const start = pinchSession.current
    if (!distance || !start.distance) return
    const center = touchCenter(event.touches, rect)
    const nextScale = clampScale(start.scale * (distance / start.distance))
    const ratio = nextScale / start.scale
    setLive({
      scale: nextScale,
      panX: center.x - (center.x - start.panX) * ratio,
      panY: center.y - (center.y - start.panY) * ratio,
    })
  }

  const handleTouchEnd = () => {
    if (!pinchSession.current) return
    pinchSession.current = null
    commitGesture()
  }

  const handlePointerDownWithState = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panLocked && event.button === 0) setIsPanning(true)
    handlePointerDown(event)
  }

  const endPanWithState = (event: React.PointerEvent<HTMLDivElement>) => {
    setIsPanning(false)
    endPan(event)
  }

  const delta = gesture ? gestureDelta(committed, gesture) : null

  return (
    <div
      ref={hostRef}
      className={`viewport-host${isPanning ? ' is-panning' : ''}${panLocked ? ' measure-active' : ''}`}
      onWheel={handleWheel}
      onPointerDown={handlePointerDownWithState}
      onPointerMove={handlePointerMove}
      onPointerUp={endPanWithState}
      onPointerCancel={endPanWithState}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      aria-label="Cizim alani: surukleyerek kaydir, tekerlek veya iki parmakla yakinlastir"
    >
      <div
        className={`viewport-transform${delta ? ' is-gesturing' : ''}`}
        style={delta ? { transform: `translate(${delta.panX}px, ${delta.panY}px) scale(${delta.scale})` } : undefined}
      >
        {children(committed)}
      </div>
    </div>
  )
}

function LayerPanel({
  layers,
  hiddenLayers,
  entityCounts,
  onToggle,
  onShowAll,
  onHideAll,
  onClose,
}: {
  layers: string[]
  hiddenLayers: Set<string>
  entityCounts: Map<string, number>
  onToggle: (layer: string) => void
  onShowAll: () => void
  onHideAll: () => void
  onClose: () => void
}) {
  const visibleCount = layers.filter((layer) => !hiddenLayers.has(layer)).length

  return (
    <div className="layers-panel" role="dialog" aria-label="Katman listesi">
      <div className="layers-panel-header">
        <strong>Katmanlar</strong>
        <span className="layers-panel-meta">
          {visibleCount}/{layers.length} acik
        </span>
        <button type="button" className="layers-panel-close" aria-label="Katman panelini kapat" onClick={onClose}>
          x
        </button>
      </div>
      <div className="layers-panel-actions">
        <button type="button" onClick={onShowAll}>
          Tumunu ac
        </button>
        <button type="button" onClick={onHideAll}>
          Tumunu kapat
        </button>
      </div>
      <ul className="layers-list">
        {layers.map((layer) => {
          const visible = !hiddenLayers.has(layer)
          const count = entityCounts.get(layer)

          return (
            <li key={layer}>
              <label className="layer-row">
                <input type="checkbox" checked={visible} onChange={() => onToggle(layer)} />
                <span className="layer-name">{layer}</span>
                {count !== undefined && <span className="layer-count">{count}</span>}
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function CommentsPanel({
  comments,
  color,
  onAdd,
  onDelete,
  onClose,
}: {
  comments: CommentRecord[]
  color: string
  onAdd: () => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  return (
    <div className="comments-panel" role="dialog" aria-label="Yorumlar">
      <div className="tool-panel-header">
        <strong>Comments</strong>
        <span>{comments.length}</span>
        <button type="button" aria-label="Yorumlari kapat" onClick={onClose}>
          x
        </button>
      </div>
      <button type="button" className="tool-panel-primary" onClick={onAdd}>
        Add comment
      </button>
      <ul className="comments-list">
        {comments.length === 0 && <li className="tool-panel-empty">Henüz yorum yok.</li>}
        {comments.map((comment) => (
          <li key={comment.id} className="comment-row" style={{ borderLeftColor: comment.color }}>
            <div>
              <strong>{comment.text}</strong>
              <span>{comment.createdAt}</span>
            </div>
            <button type="button" aria-label="Yorumu sil" onClick={() => onDelete(comment.id)}>
              x
            </button>
          </li>
        ))}
      </ul>
      <span className="tool-panel-current" style={{ color }}>
        Active color
      </span>
    </div>
  )
}

function ColorPalettePanel({
  color,
  onSelect,
  onClose,
}: {
  color: string
  onSelect: (color: string) => void
  onClose: () => void
}) {
  return (
    <div className="color-panel" role="dialog" aria-label="Renk paleti">
      <div className="tool-panel-header">
        <strong>Color Palette</strong>
        <span style={{ color }}>{color}</span>
        <button type="button" aria-label="Renk paletini kapat" onClick={onClose}>
          x
        </button>
      </div>
      <div className="color-grid">
        {MARKUP_COLORS.map((swatch) => (
          <button
            type="button"
            className={swatch === color ? 'color-swatch active' : 'color-swatch'}
            key={swatch}
            aria-label={`Renk ${swatch}`}
            style={{ backgroundColor: swatch }}
            onClick={() => onSelect(swatch)}
          />
        ))}
      </div>
    </div>
  )
}

function DxfDrawing({
  entities,
  hiddenLayers,
  lowPerf,
  entityLimit,
}: {
  entities: DrawingEntity[]
  hiddenLayers: Set<string>
  lowPerf: boolean
  entityLimit: number
}) {
  const visibleEntities = useMemo(
    () => entities.filter((entity) => !hiddenLayers.has(entity.layer)).slice(0, entityLimit),
    [entities, entityLimit, hiddenLayers],
  )
  const bounds = useMemo(() => boundsForEntities(visibleEntities), [visibleEntities])
  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  const scale = Math.min(330 / width, 640 / height)
  const offsetX = 30 + (330 - width * scale) / 2
  const offsetY = 60 + (640 - height * scale) / 2
  const toX = (x: number) => offsetX + (x - bounds.minX) * scale
  const toY = (y: number) => offsetY + (bounds.maxY - y) * scale

  const arcPath = (entity: Extract<DrawingEntity, { type: 'arc' }>) => {
    const start = (entity.start * Math.PI) / 180
    const end = (entity.end * Math.PI) / 180
    const startPoint = {
      x: entity.cx + entity.r * Math.cos(start),
      y: entity.cy + entity.r * Math.sin(start),
    }
    const endPoint = {
      x: entity.cx + entity.r * Math.cos(end),
      y: entity.cy + entity.r * Math.sin(end),
    }
    const largeArc = Math.abs(entity.end - entity.start) > 180 ? 1 : 0

    return `M ${toX(startPoint.x)} ${toY(startPoint.y)} A ${entity.r * scale} ${entity.r * scale} 0 ${largeArc} 0 ${toX(endPoint.x)} ${toY(endPoint.y)}`
  }

  return (
    <svg className={`opened-dxf${lowPerf ? ' perf-simple' : ''}`} viewBox="0 0 390 760" role="img" aria-label="DXF drawing preview">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {visibleEntities.map((entity, index) => {
          if (entity.type === 'line') {
            return (
              <line
                className="opened-line"
                key={index}
                x1={toX(entity.x1)}
                y1={toY(entity.y1)}
                x2={toX(entity.x2)}
                y2={toY(entity.y2)}
              />
            )
          }

          if (entity.type === 'circle') {
            return <circle className="opened-line" key={index} cx={toX(entity.cx)} cy={toY(entity.cy)} r={entity.r * scale} />
          }

          if (entity.type === 'arc') {
            return <path className="opened-line" key={index} d={arcPath(entity)} />
          }

          if (entity.type === 'polyline' || entity.type === 'solid') {
            const points = entity.points.map((point) => `${toX(point.x)},${toY(point.y)}`).join(' ')
            const closed = entity.type === 'polyline' && entity.closed
            return <polyline className="opened-line" key={index} points={points} {...(closed ? { 'data-closed': 'true' } : {})} />
          }

          return null
        })}
      </g>
    </svg>
  )
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const lastUrlRef = useRef<string | null>(null)
  const lastExternalFileIdRef = useRef<string | null>(null)
  const viewportRef = useRef<ViewportHandle | null>(null)
  const [openedFile, setOpenedFile] = useState<OpenedFile | null>(null)
  const [openedPath, setOpenedPath] = useState('')
  const [openPanelOpen, setOpenPanelOpen] = useState(false)
  const [fileBusy, setFileBusy] = useState(false)
  const [openStatus, setOpenStatus] = useState('')
  const [error, setError] = useState('')
  const [layersPanelOpen, setLayersPanelOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [screen, setScreen] = useState<'home' | 'viewer'>('home')
  const [recentList, setRecentList] = useState<RecentFileEntry[]>(() => listRecentFiles())
  const [activeCategory, setActiveCategory] = useState<MainCategory | null>(null)
  const [colorModalOpen, setColorModalOpen] = useState(false)
  const [colorMode, setColorMode] = useState<'byLayer' | 'byBlock' | 'aci'>('byLayer')
  const layerSnapshotRef = useRef<Set<string> | null>(null)
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(() => new Set())
  const [measurePanelOpen, setMeasurePanelOpen] = useState(false)
  const [measureOverlaysHidden, setMeasureOverlaysHidden] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const editTargetRef = useRef<SketchShape | null>(null)
  const [customLayers, setCustomLayers] = useState<string[]>([])
  const [defaultLayer, setDefaultLayer] = useState('0')
  const [measureSession, setMeasureSession] = useState<MeasureSession>('normal')
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false)
  const [colorPanelOpen, setColorPanelOpen] = useState(false)
  const [drawModeOpen, setDrawModeOpen] = useState(false)
  const [activeDrawTool, setActiveDrawTool] = useState<DrawTool>('sketch')
  const [activeDrawActionId, setActiveDrawActionId] = useState<string | null>(null)
  const [activeMeasureMode, setActiveMeasureMode] = useState<MeasureMode>(null)
  const [activeMeasureActionId, setActiveMeasureActionId] = useState<string | null>(null)
  const [activeBottomAction, setActiveBottomAction] = useState<BottomAction | null>(null)
  const [draftPoints, setDraftPoints] = useState<Point2[]>([])
  const [draftSketchShape, setDraftSketchShape] = useState<SketchShape | null>(null)
  const [measureRecords, setMeasureRecords] = useState<MeasureRecord[]>([])
  const [redoMeasureRecords, setRedoMeasureRecords] = useState<MeasureRecord[]>([])
  const [sketchShapes, setSketchShapes] = useState<SketchShape[]>([])
  const [activeEditTool, setActiveEditTool] = useState<EditTool | null>(null)
  const [activeEditActionId, setActiveEditActionId] = useState<string | null>(null)
  const [markupPlaceMode, setMarkupPlaceMode] = useState<MarkupPlaceMode>(null)
  const [activeMarkupActionId, setActiveMarkupActionId] = useState<string | null>(null)
  const [numberMarkers, setNumberMarkers] = useState<NumberMarker[]>([])
  const [mediaMarkers, setMediaMarkers] = useState<MediaMarker[]>([])
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null)
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null)
  const [pendingVideoUrl, setPendingVideoUrl] = useState<string | null>(null)
  const [comments, setComments] = useState<CommentRecord[]>([])
  const [activeMarkupColor, setActiveMarkupColor] = useState('#18f4ea')
  const [notice, setNotice] = useState('')
  const [viewport, setViewport] = useState<ViewportState>({ scale: 1, panX: 0, panY: 0 })
  const [unitsPerDrawingUnit, setUnitsPerDrawingUnit] = useState(0.01)
  const [unitLabel, setUnitLabel] = useState('m')
  const contentRef = useRef<HTMLDivElement>(null)
  const snapRafRef = useRef<number | null>(null)
  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadSettings())
  const [snapPreview, setSnapPreview] = useState<{ point: Point2; kind: SnapKind } | null>(null)
  const [pro, setPro] = useState(() => loadEntitlement().pro)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [upgradeBusy, setUpgradeBusy] = useState(false)
  const [upgradeError, setUpgradeError] = useState('')
  const [priceLabel, setPriceLabel] = useState('Google Play fiyati')
  const [viewSize, setViewSize] = useState({ width: 390, height: 760 })
  const [zoomWindowMode, setZoomWindowMode] = useState(false)
  const [textNotes, setTextNotes] = useState<TextNote[]>([])
  const [pendingText, setPendingText] = useState<string | null>(null)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [mediaPreview, setMediaPreview] = useState<MediaMarker | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const zoomDrag = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const online = useOnlineStatus()
  const lowPerf = useMemo(() => resolvePerformanceMode(appSettings.performanceMode), [appSettings.performanceMode])
  const entityLimit = entityRenderLimit(lowPerf)
  const viewportResetKey = openedFile ? `${openedFile.name}-${openedFile.format}-${openedFile.layoutName ?? ''}` : 'demo'

  const dxfEntities = openedFile && openedFile.format !== 'pdf' ? openedFile.entities : undefined
  const layerList = useMemo(() => {
    const base = dxfEntities?.length ? layersFromEntities(dxfEntities) : []
    return [...new Set([...base, ...customLayers])].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [customLayers, dxfEntities])
  const entityCounts = useMemo(
    () => (dxfEntities?.length ? countEntitiesByLayer(dxfEntities) : new Map<string, number>()),
    [dxfEntities],
  )

  const visibleDxfEntities = useMemo(
    () => (dxfEntities ?? []).filter((entity) => !hiddenLayers.has(entity.layer)),
    [dxfEntities, hiddenLayers],
  )
  const coordMode = visibleDxfEntities.length ? 'dxf' : 'demo'
  const sceneBounds = useMemo(
    () => (visibleDxfEntities.length ? boundsForEntities(visibleDxfEntities, openedFile?.document?.extents) : null),
    [openedFile?.document?.extents, visibleDxfEntities],
  )
  const dxfTransform = useMemo(
    () => (sceneBounds ? buildDxfTransform(sceneBounds, viewSize.width, viewSize.height) : undefined),
    [sceneBounds, viewSize.height, viewSize.width],
  )
  const canvasEntities = useMemo(
    () => (openedFile?.entities ?? []).slice(0, entityLimit),
    [entityLimit, openedFile?.entities],
  )
  const measureHint = activeMeasureMode ? MEASURE_HINTS[activeMeasureMode] : ''

  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', appSettings.theme === 'dark')
    document.documentElement.classList.toggle('theme-light', appSettings.theme === 'light')
  }, [appSettings.theme])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const darkChrome = screen === 'viewer'
    void import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
      void StatusBar.setStyle({ style: darkChrome ? Style.Dark : Style.Light })
    })
  }, [screen])

  useEffect(() => {
    const element = contentRef.current
    if (!element || screen !== 'viewer') return
    const update = () => {
      const stage = element.closest('.cad-stage')
      const target = stage instanceof HTMLElement ? stage : element
      setViewSize({
        width: Math.max(1, Math.round(target.clientWidth)),
        height: Math.max(1, Math.round(target.clientHeight)),
      })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    const stage = element.closest('.cad-stage')
    if (stage instanceof HTMLElement && stage !== element) observer.observe(stage)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [screen, openedFile?.name, openedFile?.layoutName])

  useEffect(() => {
    void refreshEntitlement().then((entitlement) => setPro(entitlement.pro))
    void loadProProduct().then((product) => {
      if (product?.priceString) setPriceLabel(product.priceString)
    })
  }, [])

  const notify = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice((current) => (current === message ? '' : current)), 2200)
  }, [])

  const snapTargets = useMemo(() => {
    if (coordMode === 'dxf') return collectSnapTargets(visibleDxfEntities, appSettings.snap)
    return collectSnapTargets([], appSettings.snap, DEMO_SNAP_POINTS)
  }, [appSettings.snap, coordMode, visibleDxfEntities])

  const resolveMeasurePoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!contentRef.current) return null
      const raw = screenToWorldPoint(clientX, clientY, contentRef.current, viewport, coordMode, dxfTransform)
      if (!raw) return null

      if (!appSettings.snap.enabled) {
        setSnapPreview(null)
        return raw
      }

      const tolerance = snapToleranceInCoords(
        viewport.scale,
        contentRef.current.clientHeight,
        VIEW_BOX.height,
        34,
      )
      const hit = findNearestSnap(raw, snapTargets, tolerance, appSettings.snap)
      if (hit) {
        setSnapPreview({ point: hit.point, kind: hit.kind })
        return hit.point
      }

      setSnapPreview(null)
      return raw
    },
    [appSettings.snap, coordMode, dxfTransform, snapTargets, viewport],
  )

  const updateSnapSettings = (snap: AppSettings['snap']) => {
    const next = { ...appSettings, snap }
    setAppSettings(next)
    saveSettings(next)
  }

  const togglePerformanceMode = () => {
    const nextMode = lowPerf ? 'high' : 'low'
    const next = { ...appSettings, performanceMode: nextMode as AppSettings['performanceMode'] }
    setAppSettings(next)
    saveSettings(next)
    notify(nextMode === 'low' ? 'Dusuk performans modu acildi.' : 'Yuksek kalite modu acildi.')
  }

  useEffect(() => {
    setHiddenLayers(new Set())
    setLayersPanelOpen(false)
    setMeasurePanelOpen(false)
    setSettingsPanelOpen(false)
    setCommentsPanelOpen(false)
    setColorPanelOpen(false)
    setDrawModeOpen(false)
    setActiveMeasureMode(null)
    setActiveMeasureActionId(null)
    setActiveBottomAction(null)
    setDraftPoints([])
    setDraftSketchShape(null)
    setMeasureRecords([])
    setRedoMeasureRecords([])
    setSketchShapes([])
    setMeasureSession('normal')
    setMeasureOverlaysHidden(false)
    setActiveDrawTool('sketch')
    setActiveDrawActionId(null)
    setActiveEditTool(null)
    setActiveEditActionId(null)
    setMarkupPlaceMode(null)
    setActiveMarkupActionId(null)
    setNumberMarkers([])
    setMediaMarkers([])
    setPendingImageUrl(null)
    setCustomLayers([])
  }, [openedFile?.name, openedFile?.format])

  const closeInteractionModes = () => {
    setDrawModeOpen(false)
    setActiveDrawActionId(null)
    setActiveEditTool(null)
    setActiveEditActionId(null)
    setMarkupPlaceMode(null)
    setActiveMarkupActionId(null)
    setActiveMeasureMode(null)
    setActiveMeasureActionId(null)
    setMeasureSession('normal')
    editTargetRef.current = null
  }

  const selectDrawTool = (actionId: string) => {
    const tool = actionIdToDrawTool(actionId)
    if (!tool) return false

    setActiveMeasureMode(null)
    setActiveMeasureActionId(null)
    setMeasureSession('normal')
    setDraftPoints([])
    setDraftSketchShape(null)
    setActiveEditTool(null)
    setActiveEditActionId(null)
    setMarkupPlaceMode(null)
    setActiveMarkupActionId(null)
    editTargetRef.current = null
    setActiveDrawTool(tool)
    setActiveDrawActionId(actionId)
    if (actionId.startsWith('ann-')) setActiveCategory('annotation')
    else if (actionId.startsWith('draw-')) setActiveCategory('draw')
    setDrawModeOpen(true)
    setMeasurePanelOpen(false)
    setLayersPanelOpen(false)
    setSettingsPanelOpen(false)
    setCommentsPanelOpen(false)
    setColorPanelOpen(false)
    setMenuOpen(false)
    notify(`${DRAW_LABELS[tool]} modu: ${DRAW_HINTS[tool]}`)
    return true
  }

  const selectEditTool = (actionId: string) => {
    const tool = actionIdToEditTool(actionId)
    if (!tool) return false
    closeInteractionModes()
    setActiveEditTool(tool)
    setActiveEditActionId(actionId)
    setActiveCategory('edit')
    editTargetRef.current = null
    notify(`${EDIT_LABELS[tool]}: ${EDIT_HINTS[tool]}`)
    return true
  }

  const selectMarkupPlace = (actionId: string, mode: MarkupPlaceMode) => {
    closeInteractionModes()
    setMarkupPlaceMode(mode)
    setActiveMarkupActionId(actionId)
    setActiveCategory('annotation')
    if (mode === 'number') notify('Numaralandirma: konuma dokun.')
    if (mode === 'audio') notify('Ses notu: konuma dokun.')
    if (mode === 'video') notify('Video notu: konuma dokun.')
    if (mode === 'image') notify('Goruntu: konuma dokun.')
    return true
  }

  const selectMeasureMode = (mode: MeasureMode, session: MeasureSession = 'normal', actionId?: string) => {
    const togglingOff = activeMeasureMode === mode && session === 'normal' && measureSession === 'normal'
    setMeasureSession(togglingOff ? 'normal' : session)
    setDrawModeOpen(false)
    setActiveDrawActionId(null)
    setActiveEditTool(null)
    setActiveEditActionId(null)
    setMarkupPlaceMode(null)
    setActiveMarkupActionId(null)
    editTargetRef.current = null
    setActiveMeasureMode(togglingOff ? null : mode)
    setActiveMeasureActionId(togglingOff ? null : actionId ?? null)
    setDraftPoints([])
    setSnapPreview(null)
    if (mode && !togglingOff) {
      const category =
        actionId?.startsWith('dim-') ? 'dimension' : actionId === 'draw-divide' ? 'draw' : 'measure'
      setActiveCategory(category)
      setLayersPanelOpen(false)
      setSettingsPanelOpen(false)
      setCommentsPanelOpen(false)
      setColorPanelOpen(false)
      setDrawModeOpen(false)
      setMenuOpen(false)
    }
  }

  const fastViewActiveActionId = useMemo(() => {
    if (activeEditActionId) return activeEditActionId
    if (activeMarkupActionId) return activeMarkupActionId
    if (drawModeOpen && activeDrawActionId) return activeDrawActionId
    if (activeMeasureActionId) return activeMeasureActionId
    if (!activeMeasureMode) return null
    const map: Record<MeasureMode, string> = {
      distance: 'measure-distance',
      area: 'measure-area',
      angle: 'measure-angle',
      arc: 'measure-arc',
      point: 'measure-point',
      calibration: 'measure-scale',
    }
    return map[activeMeasureMode]
  }, [
    activeDrawActionId,
    activeEditActionId,
    activeMarkupActionId,
    activeMeasureActionId,
    activeMeasureMode,
    drawModeOpen,
  ])

  useEffect(() => {
    if (!activeMeasureMode) setSnapPreview(null)
  }, [activeMeasureMode])

  const finalizeDraft = (points: Point2[], mode: MeasureMode) => {
    if (mode === 'calibration' && points.length >= 2) {
      const drawingDistance = distance(points[0], points[1])
      const realRaw = window.prompt(
        `Cizim mesafesi ${drawingDistance.toFixed(3)} birim. Gercek mesafe?`,
        String(drawingDistance * unitsPerDrawingUnit || 1),
      )
      const unitRaw = window.prompt('Birim (m, mm, cm, ft)', unitLabel) ?? unitLabel
      const realDistance = Number.parseFloat(realRaw ?? '')
      if (Number.isFinite(realDistance) && realDistance > 0) {
        setUnitsPerDrawingUnit(calibrationFactor(drawingDistance, realDistance))
        setUnitLabel(unitRaw.trim() || unitLabel)
      }
      setActiveMeasureMode(null)
      setActiveMeasureActionId(null)
      return
    }

    if (!pro && measureRecords.length >= FREE_MEASURE_LIMIT) {
      setUpgradeOpen(true)
      notify(`Ucretsiz planda ${FREE_MEASURE_LIMIT} olcum siniri doldu.`)
      return
    }

    const record = buildMeasureRecord(mode, points, unitsPerDrawingUnit, unitLabel, {
      label:
        measureSession === 'radius' ? 'Radius' : measureSession === 'diameter' ? 'Cap' : undefined,
      decimals: appSettings.measureDecimals,
    })
    if (record) {
      setMeasureRecords((current) => [...current, record])
      setRedoMeasureRecords([])
      setMeasurePanelOpen(true)
    }
    if (mode !== 'area' && measureSession === 'normal') {
      setActiveMeasureMode(null)
      setActiveMeasureActionId(null)
    }
  }

  const handleMeasurePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activeMeasureMode || !contentRef.current) return
    event.stopPropagation()

    if (activeMeasureMode === 'area' && event.detail === 2) {
      event.preventDefault()
      setDraftPoints((current) => {
        if (current.length >= 3) finalizeDraft(current, 'area')
        return []
      })
      setActiveMeasureMode(null)
      setActiveMeasureActionId(null)
      return
    }

    const point = resolveMeasurePoint(event.clientX, event.clientY)
    if (!point) return

    if (measureSession === 'entity') {
      const tolerance = contentRef.current
        ? snapToleranceInCoords(viewport.scale, contentRef.current.clientHeight, VIEW_BOX.height, 40)
        : 20
      const entities = visibleDxfEntities.length ? visibleDxfEntities : []
      const hit = findNearestEntity(point, entities, tolerance)
      if (!hit) {
        notify('Yakin varlik bulunamadi.')
        return
      }

      setMeasureRecords((current) => [
        ...current,
        {
          id: `m-${Date.now()}-${current.length}`,
          kind: 'point',
          label: 'Varlik',
          value: 0,
          displayValue: `${hit.kind} · ${hit.layer}`,
          unit: unitLabel,
          points: [point],
          createdAt: new Date().toLocaleString('tr-TR'),
        },
      ])
      setMeasurePanelOpen(true)
      notify(`${hit.kind} secildi (${hit.layer}).`)
      return
    }

    setDraftPoints((current) => {
      const next = [...current, point]
      if (activeMeasureMode === 'area') return next

      if (activeMeasureMode === 'distance' && measureSession === 'continuous' && next.length >= 2) {
        finalizeDraft([next.at(-2)!, next.at(-1)!], 'distance')
        return [next.at(-1)!]
      }

      if (activeMeasureMode && canFinalize(activeMeasureMode, next)) {
        finalizeDraft(next, activeMeasureMode)
        return []
      }
      return next
    })
  }

  const toggleLayer = (layer: string) => {
    setHiddenLayers((current) => {
      const next = new Set(current)
      if (next.has(layer)) next.delete(layer)
      else next.add(layer)
      return next
    })
  }

  const showAllLayers = () => setHiddenLayers(new Set())
  const hideAllLayers = () => setHiddenLayers(new Set(layerList))

  const closeSubPanels = () => {
    setLayersPanelOpen(false)
    setMeasurePanelOpen(false)
    setSettingsPanelOpen(false)
    setCommentsPanelOpen(false)
    setColorPanelOpen(false)
    setMenuOpen(false)
  }

  const handleFastViewSubAction = (actionId: string) => {
    if (VIP_ACTIONS.has(actionId) && !pro) {
      setUpgradeOpen(true)
      notify('Bu arac Pro kilidinde.')
      return
    }
    if (actionId === 'ann-text' || actionId === 'draw-text') {
      const text = window.prompt('Cizime eklenecek metin')
      const trimmed = text?.trim()
      if (!trimmed) return
      setPendingText(trimmed)
      setMarkupPlaceMode(null)
      setDrawModeOpen(false)
      notify('Metni yerlestirmek icin cizime dokunun.')
      return
    }
    if (actionId === 'layer-list') {
      setLayersPanelOpen(true)
      notify('Katman listesi acildi.')
      return
    }
    if (actionId === 'layer-all-on') {
      showAllLayers()
      notify('Tum katmanlar acildi.')
      return
    }
    if (actionId === 'layer-off') {
      setLayersPanelOpen(true)
      const target = layerList.find((layer) => !hiddenLayers.has(layer))
      if (target) toggleLayer(target)
      notify(target ? `${target} katmani kapatildi.` : 'Kapatilacak katman yok.')
      return
    }
    if (actionId === 'layer-isolate') {
      const target = layerList.find((layer) => !hiddenLayers.has(layer))
      if (!target) return
      layerSnapshotRef.current = new Set(hiddenLayers)
      setHiddenLayers(new Set(layerList.filter((layer) => layer !== target)))
      notify(`${target} katmani izole edildi.`)
      return
    }
    if (actionId === 'layer-previous') {
      if (!layerSnapshotRef.current) {
        notify('Onceki katman durumu yok.')
        return
      }
      setHiddenLayers(new Set(layerSnapshotRef.current))
      layerSnapshotRef.current = null
      notify('Onceki katman durumu yuklendi.')
      return
    }
    if (actionId === 'layer-new') {
      const name = window.prompt('Yeni katman adi')
      const trimmed = name?.trim()
      if (!trimmed) return
      setCustomLayers((current) => [...new Set([...current, trimmed])])
      notify(`${trimmed} katmani eklendi.`)
      return
    }
    if (actionId === 'layer-default') {
      const name = window.prompt('Varsayilan katman', defaultLayer)
      const trimmed = name?.trim()
      if (!trimmed) return
      setDefaultLayer(trimmed)
      notify(`${trimmed} varsayilan katman yapildi.`)
      return
    }

    if (actionId === 'measure-distance') {
      selectMeasureMode('distance', 'normal', actionId)
      return
    }
    if (actionId === 'measure-area') {
      selectMeasureMode('area', 'normal', actionId)
      return
    }
    if (actionId === 'measure-point') {
      selectMeasureMode('point', 'normal', actionId)
      return
    }
    if (actionId === 'measure-arc') {
      selectMeasureMode('arc', 'normal', actionId)
      return
    }
    if (actionId === 'measure-angle') {
      selectMeasureMode('angle', 'normal', actionId)
      return
    }
    if (actionId === 'measure-scale') {
      selectMeasureMode('calibration', 'normal', actionId)
      return
    }
    if (actionId === 'measure-results') {
      setMeasurePanelOpen(true)
      notify('Olcum sonuclari listelendi.')
      return
    }
    if (actionId === 'measure-count') {
      notify(`${measureRecords.length} olcum kaydi var.`)
      setMeasurePanelOpen(true)
      return
    }
    if (actionId === 'measure-precision') {
      setSettingsPanelOpen(true)
      notify('Hassasiyet ayarlari acildi.')
      return
    }
    if (actionId === 'measure-continuous') {
      selectMeasureMode('distance', 'continuous', actionId)
      notify('Surekli olcum: noktalar arasi mesafeler zincirlenir.')
      return
    }
    if (actionId === 'measure-facade') {
      selectMeasureMode('area', 'normal', actionId)
      notify('Cephe olcumu: alan icin kose noktalari secin.')
      return
    }
    if (actionId === 'measure-batch') {
      selectMeasureMode('distance', 'batch', actionId)
      notify('Toplu olcum: her iki noktada bir kayit olusturulur.')
      return
    }
    if (actionId === 'measure-entity') {
      selectMeasureMode('point', 'entity', actionId)
      notify('Varlik: cizim uzerinde bir nesne secin.')
      return
    }

    if (actionId === 'dim-linear') {
      selectMeasureMode('distance', 'normal', actionId)
      notify('Dogrusal boyut olcumu basladi.')
      return
    }
    if (actionId === 'dim-aligned') {
      selectMeasureMode('distance', 'normal', actionId)
      notify('Hizali boyut olcumu basladi.')
      return
    }
    if (actionId === 'dim-angular') {
      selectMeasureMode('angle', 'normal', actionId)
      return
    }
    if (actionId === 'dim-arclength' || actionId === 'dim-3point-arc') {
      selectMeasureMode('arc', 'normal', actionId)
      return
    }
    if (actionId === 'dim-radius') {
      selectMeasureMode('distance', 'radius', actionId)
      notify('Radius olcumu: merkez ve kenar noktasi secin.')
      return
    }
    if (actionId === 'dim-diameter') {
      selectMeasureMode('distance', 'diameter', actionId)
      notify('Cap olcumu: iki uç nokta secin.')
      return
    }

    if (actionIdToDrawTool(actionId)) {
      if (selectDrawTool(actionId)) return
    }
    if (actionId === 'ann-text' || actionId === 'draw-text') {
      closeInteractionModes()
      setCommentsPanelOpen(true)
      addComment()
      return
    }
    if (actionId === 'ann-number') {
      selectMarkupPlace(actionId, 'number')
      return
    }
    if (actionId === 'ann-audio') {
      audioInputRef.current?.click()
      return
    }
    if (actionId === 'ann-video') {
      videoInputRef.current?.click()
      return
    }
    if (actionId === 'ann-image') {
      imageInputRef.current?.click()
      return
    }
    if (actionId === 'draw-smartpen') {
      if (selectDrawTool('draw-sketch')) return
    }
    if (actionId === 'draw-divide') {
      selectMeasureMode('distance', 'normal', actionId)
      notify('Bolme: mesafe olcumu ile iki nokta arasini bolun.')
      return
    }

    if (actionIdToEditTool(actionId)) {
      if (selectEditTool(actionId)) return
    }
  }

  const handleCategorySelect = (category: MainCategory) => {
    if (category === 'color') {
      if (activeCategory === 'color' && colorModalOpen) {
        setActiveCategory(null)
        setColorModalOpen(false)
        return
      }
      setActiveCategory('color')
      closeSubPanels()
      setColorModalOpen(true)
      return
    }

    setActiveCategory((current) => (current === category ? null : category))
    closeSubPanels()
    setColorModalOpen(false)

    if (category === 'layer') {
      setLayersPanelOpen(true)
    }
  }

  const handleTopBarAction = (action: 'save' | 'undo' | 'redo' | 'layout' | 'zoomWindow' | 'fit' | 'menu') => {
    if (action === 'menu') {
      setMenuOpen((open) => !open)
      return
    }
    if (action === 'layout') {
      const layouts = openedFile?.document?.layouts ?? []
      if (layouts.length < 2) {
        togglePerformanceMode()
        notify('Bu cizimde tek duzen var. Performans modu degisti.')
        return
      }
      const current = openedFile?.layoutName ?? 'Model'
      const index = layouts.findIndex((layout) => layout.name === current)
      const next = layouts[(index + 1) % layouts.length]
      setOpenedFile((file) => (file ? { ...file, entities: next.entities, layoutName: next.name, summary: `${next.entities.length} varlik · ${next.name}` } : file))
      notify(`${next.name} duzeni acildi.`)
      return
    }
    if (action === 'zoomWindow') {
      setZoomWindowMode((current) => !current)
      notify(zoomWindowMode ? 'Pencere yakinlastirma kapandi.' : 'Yakinlastirilacak alani surukleyin.')
      return
    }
    handleToolbarAction(action)
  }

  const shareDrawing = async (kind: 'png' | 'pdf') => {
    const entities = openedFile?.entities
    if (!entities?.length) {
      notify('Disa aktarilacak cizim yok.')
      return
    }
    try {
      const base = (openedFile?.name ?? 'cizim').replace(/\.[^.]+$/, '')
      const watermark = pro ? null : 'DWG Viewer'
      if (kind === 'pdf') await exportDrawingPdf(entities, hiddenLayers, appSettings.theme, base, watermark, appSettings.showLineweights)
      else await exportDrawingPng(entities, hiddenLayers, appSettings.theme, base, watermark, appSettings.showLineweights)
      notify(kind === 'pdf' ? 'PDF paylasildi.' : 'Gorsel paylasildi.')
    } catch (exportError) {
      notify(exportError instanceof Error ? exportError.message : 'Disa aktarma basarisiz.')
    }
  }

  const buyPro = async () => {
    setUpgradeBusy(true)
    setUpgradeError('')
    try {
      const entitlement = await purchasePro()
      setPro(entitlement.pro)
      if (entitlement.pro) {
        setUpgradeOpen(false)
        notify('Pro acildi.')
      }
    } catch (purchaseError) {
      setUpgradeError(purchaseError instanceof Error ? purchaseError.message : 'Satin alma tamamlanamadi.')
    } finally {
      setUpgradeBusy(false)
    }
  }

  const handleRestorePro = async () => {
    setUpgradeBusy(true)
    setUpgradeError('')
    try {
      const entitlement = await restoreProPurchase()
      setPro(entitlement.pro)
      notify(entitlement.pro ? 'Satin alma geri yuklendi.' : 'Geri yuklenecek satin alma yok.')
      if (entitlement.pro) setUpgradeOpen(false)
    } catch (restoreError) {
      setUpgradeError(restoreError instanceof Error ? restoreError.message : 'Geri yukleme basarisiz.')
    } finally {
      setUpgradeBusy(false)
    }
  }

  const openSample = async (format: 'dwg' | 'dxf') => {
    setFileBusy(true)
    setOpenStatus('Ornek plan hazirlaniyor...')
    try {
      if (format === 'dwg') {
        const { sampleDwgBytes } = await import('./cad/samplePlan')
        const bytes = sampleDwgBytes()
        const file = new File([bytes], 'ornek-plan.dwg', { type: 'application/octet-stream' })
        await openFromFile(file, 'device', false, 'Ornekler > ornek-plan.dwg')
        return
      }
      const { SAMPLE_RICH_DXF } = await import('./cad/samplePlan')
      const file = new File([SAMPLE_RICH_DXF], 'ornek-plan.dxf', { type: 'application/dxf' })
      await openFromFile(file, 'device', false, 'Ornekler > ornek-plan.dxf')
    } catch (sampleError) {
      setError(sampleError instanceof Error ? sampleError.message : 'Ornek cizim acilamadi.')
    } finally {
      setFileBusy(false)
    }
  }

  const enterViewer = () => {
    setScreen('viewer')
    setActiveCategory(null)
    setMenuOpen(false)
  }

  const exitViewer = () => {
    setScreen('home')
    setOpenedFile(null)
    setOpenedPath('')
    setActiveCategory(null)
    setMenuOpen(false)
    setColorModalOpen(false)
    setRecentList(listRecentFiles())
  }

  const chromeBottom = useMemo(() => {
    if (!activeCategory || activeCategory === 'color') {
      return '54px'
    }
    const rows = subMenuRows(activeCategory)
    return `${54 + rows * 62 + 22}px`
  }, [activeCategory])

  const applyOpenResult = (result: Awaited<ReturnType<typeof buildOpenedFile>>) => {
    if (result.ok === false) {
      setOpenedFile(null)
      setError(result.error)
      setScreen('viewer')
      return
    }

    if (lastUrlRef.current) {
      URL.revokeObjectURL(lastUrlRef.current)
      lastUrlRef.current = null
    }

    if (result.objectUrl) lastUrlRef.current = result.objectUrl

    setError('')
    setOpenedFile(result.file)
    const hidden = new Set((result.file.document?.layers ?? []).filter((layer) => !layer.visible).map((layer) => layer.name))
    setHiddenLayers(hidden)
    setOpenPanelOpen(false)
    setOpenStatus('')
    setScreen('viewer')
    setRecentList(listRecentFiles())
  }

  const openFromFile = async (file: File, source: FileSource, skipRecent = false, sourcePath?: string) => {
    setFileBusy(true)
    setOpenStatus('Dosya aciliyor...')
    try {
      const result = await buildOpenedFile(file, source, { skipRecent })
      applyOpenResult(result)
      if (result.ok) {
        setOpenedPath(sourcePath || `${sourceLabel(source)} > ${file.name}`)
      }
    } catch {
      setError('Dosya acilirken hata olustu.')
    } finally {
      setFileBusy(false)
    }
  }

  useEffect(() => {
    const handleExternalFile = async (event: Event) => {
      const detail = (event as CustomEvent<ExternalFilePayload>).detail
      if (!detail) return
      if (detail.id && lastExternalFileIdRef.current === detail.id) return

      setError('')
      setOpenPanelOpen(false)

      try {
        const file = fileFromPayload(detail)
        await openFromFile(file, 'device', false, detail.sourcePath || `Paylasim > ${file.name}`)
        if (detail.id) lastExternalFileIdRef.current = detail.id
        notify('Paylasilan dosya acildi.')
      } catch (openError) {
        const message = openError instanceof Error ? openError.message : 'Dosya acilamadi.'
        setOpenedFile(null)
        setScreen('viewer')
        setError(message)
      }
    }

    const handleExternalError = (event: Event) => {
      const detail = (event as CustomEvent<ExternalFilePayload>).detail
        setOpenedFile(null)
        setScreen('viewer')
        setError(detail?.message || 'Dosya acilamadi.')
    }

    window.addEventListener('dwg-viewer-open-file', handleExternalFile)
    window.addEventListener('dwg-viewer-open-error', handleExternalError)

    return () => {
      window.removeEventListener('dwg-viewer-open-file', handleExternalFile)
      window.removeEventListener('dwg-viewer-open-error', handleExternalError)
    }
    // Mount-only: the native bridge dispatches the open event after the WebView is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('stress') !== '1') return
    let cancelled = false
    void import('./cad/stressPlan').then(({ buildStressPlan }) => {
      if (cancelled) return
      const entities = buildStressPlan()
      setError('')
      setOpenedFile({
        name: 'cok-sayfa-plan.dxf',
        size: entities.length,
        format: 'dxf',
        source: 'device',
        entities,
        layoutName: 'Model',
        document: { format: 'dxf', version: 'STRESS', layers: [], layouts: [], warnings: [] },
      })
      setScreen('viewer')
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('stress') !== '1') return
    window.__dwgViewer = {
      zoomIn: () => viewportRef.current?.zoomIn(),
      zoomOut: () => viewportRef.current?.zoomOut(),
      fit: () => viewportRef.current?.fit(),
    }
  }, [openedFile, screen])

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await openFromFile(file, 'device', false, `Telefon dosyalari > ${file.name}`)
  }

  const handlePickDevice = async () => {
    setFileBusy(true)
    setOpenStatus('')
    try {
      const file = await pickFileFromSource('device')
      await openFromFile(file, 'device', false, `Telefon dosyalari > ${file.name}`)
    } catch (pickError) {
      const message = pickError instanceof Error ? pickError.message : 'Dosya secilemedi'
      if (!message.includes('secilmedi') && !message.includes('iptal')) setError(message)
    } finally {
      setFileBusy(false)
    }
  }

  const handlePickCloud = async (provider: CloudProvider) => {
    setFileBusy(true)
    setOpenStatus(`${provider} baglaniyor...`)
    setError('')
    try {
      const file = await pickFileFromSource(provider)
      await openFromFile(file, provider, false, `${sourceLabel(provider)} > ${file.name}`)
    } catch (pickError) {
      const message = pickError instanceof Error ? pickError.message : 'Bulut dosyasi acilamadi'
      if (message.includes('.env') || message.includes('API')) {
        setOpenStatus(message)
      } else if (!message.includes('iptal') && !message.includes('secilmedi')) {
        setError(message)
      }
    } finally {
      setFileBusy(false)
    }
  }

  const handleMeasurePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activeMeasureMode || !contentRef.current) return
    if (snapRafRef.current) return
    snapRafRef.current = window.requestAnimationFrame(() => {
      snapRafRef.current = null
      resolveMeasurePoint(event.clientX, event.clientY)
    })
  }

  const resolveSketchPoint = (clientX: number, clientY: number) => {
    if (!contentRef.current) return null
    return screenToWorldPoint(clientX, clientY, contentRef.current, viewport, coordMode, dxfTransform)
  }

  const finalizeDrawShape = (shape: SketchShape) => {
    if (!canFinalizeDrawShape(shape.kind, shape.points)) return
    setSketchShapes((current) => [...current, shape])
    setDraftSketchShape(null)
  }

  const handleDrawPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawModeOpen) return
    const point = resolveSketchPoint(event.clientX, event.clientY)
    if (!point) return

    event.stopPropagation()

    if (isTapDrawTool(activeDrawTool)) {
      if (activeDrawTool === 'polyline' && event.detail >= 2) {
        setDraftSketchShape((current) => {
          if (current && canFinalizeDrawShape('polyline', current.points)) finalizeDrawShape(current)
          return null
        })
        return
      }

      setDraftSketchShape((current) => {
        const base = current ?? {
          id: `shape-${Date.now()}`,
          kind: activeDrawTool,
          color: activeMarkupColor,
          points: [] as Point2[],
        }
        const next = { ...base, points: [...base.points, point] }
        if (activeDrawTool === 'arc' && canFinalizeDrawShape('arc', next.points)) {
          finalizeDrawShape(next)
          return null
        }
        return next
      })
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDraftSketchShape({
      id: `shape-${Date.now()}`,
      kind: activeDrawTool,
      color: activeMarkupColor,
      points: [point],
    })
  }

  const handleDrawPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawModeOpen || !draftSketchShape) return
    const point = resolveSketchPoint(event.clientX, event.clientY)
    if (!point) return

    event.preventDefault()
    event.stopPropagation()

    setDraftSketchShape((current) => {
      if (!current) return current

      if (isDragDrawTool(current.kind)) {
        return { ...current, points: [current.points[0], point] }
      }

      if (isFreehandDrawTool(current.kind)) {
        const last = current.points.at(-1)
        if (last && distance(last, point) < 1.2) return current
        return { ...current, points: [...current.points, point] }
      }

      return current
    })
  }

  const handleDrawPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawModeOpen || !draftSketchShape) return
    if (isTapDrawTool(activeDrawTool)) return

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.releasePointerCapture(event.pointerId)

    setDraftSketchShape((current) => {
      if (current && canFinalizeDrawShape(current.kind, current.points)) finalizeDrawShape(current)
      return null
    })
  }

  const handleEditPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activeEditTool || !contentRef.current) return
    const point = resolveSketchPoint(event.clientX, event.clientY)
    if (!point) return
    event.stopPropagation()

    const tolerance = snapToleranceInCoords(viewport.scale, contentRef.current.clientHeight, VIEW_BOX.height, 42)

    if (activeEditTool === 'trim') {
      const hit = findNearestSketchShape(sketchShapes, point, tolerance)
      if (!hit) {
        notify('Kirpilacak cizim bulunamadi.')
        return
      }
      setSketchShapes((current) => trimSketchShape(current, hit.id))
      notify('Secili cizim silindi.')
      return
    }

    if (activeEditTool === 'extend') {
      if (!editTargetRef.current) {
        const hit = findNearestSketchShape(sketchShapes, point, tolerance)
        if (!hit || hit.kind !== 'line') {
          notify('Uzatilacak cizgi secin.')
          return
        }
        editTargetRef.current = hit
        notify('Hedef noktaya dokunun.')
        return
      }
      const extended = extendSketchShape(editTargetRef.current, point)
      if (!extended) return
      setSketchShapes((current) => current.map((shape) => (shape.id === extended.id ? extended : shape)))
      editTargetRef.current = null
      notify('Cizgi uzatildi.')
      return
    }

    if (activeEditTool === 'offset') {
      if (!editTargetRef.current) {
        const hit = findNearestSketchShape(sketchShapes, point, tolerance)
        if (!hit) {
          notify('Offset icin sekil secin.')
          return
        }
        editTargetRef.current = hit
        notify('Offset yonu icin dokunun.')
        return
      }
      const offset = offsetSketchShape(editTargetRef.current, point)
      if (!offset) return
      setSketchShapes((current) => [...current, offset])
      editTargetRef.current = null
      notify('Offset kopyasi olusturuldu.')
      return
    }

    if (activeEditTool === 'fillet' || activeEditTool === 'chamfer') {
      const hit = findNearestSketchShape(sketchShapes, point, tolerance)
      if (!hit || hit.kind !== 'rect') {
        notify('Dikdortgen secin.')
        return
      }
      const size = Math.max(4, distance(hit.points[0], point) / 4)
      const next =
        activeEditTool === 'fillet' ? filletSketchShape(hit, size) : chamferSketchShape(hit, size)
      if (!next) return
      setSketchShapes((current) => current.map((shape) => (shape.id === next.id ? next : shape)))
      notify(activeEditTool === 'fillet' ? 'Kose yuvarlatildi.' : 'Kose olugu uygulandi.')
    }
  }

  const handleMarkupPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!markupPlaceMode) return
    const point = resolveSketchPoint(event.clientX, event.clientY)
    if (!point) return
    event.stopPropagation()

    if (markupPlaceMode === 'number') {
      setNumberMarkers((current) => [
        ...current,
        {
          id: `num-${Date.now()}`,
          number: nextNumber(current),
          point,
          color: activeMarkupColor,
        },
      ])
      notify('Numara eklendi.')
      return
    }

    if (markupPlaceMode === 'audio' || markupPlaceMode === 'video') {
      const mediaUrl = markupPlaceMode === 'audio' ? pendingAudioUrl : pendingVideoUrl
      setMediaMarkers((current) => [
        ...current,
        {
          id: `media-${Date.now()}`,
          kind: markupPlaceMode,
          point,
          label: markupPlaceMode === 'audio' ? 'Ses notu' : 'Video notu',
          color: activeMarkupColor,
          audioUrl: markupPlaceMode === 'audio' ? mediaUrl ?? undefined : undefined,
          videoUrl: markupPlaceMode === 'video' ? mediaUrl ?? undefined : undefined,
        },
      ])
      setComments((current) => [
        {
          id: `c-${Date.now()}`,
          text: markupPlaceMode === 'audio' ? '[Ses] Not eklendi' : '[Video] Not eklendi',
          color: activeMarkupColor,
          createdAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        },
        ...current,
      ])
      notify(markupPlaceMode === 'audio' ? 'Ses notu yerlestirildi.' : 'Video notu yerlestirildi.')
      return
    }

    if (markupPlaceMode === 'image' && pendingImageUrl) {
      setMediaMarkers((current) => [
        ...current,
        {
          id: `img-${Date.now()}`,
          kind: 'image',
          point,
          label: 'Goruntu',
          color: activeMarkupColor,
          imageUrl: pendingImageUrl,
        },
      ])
      notify('Goruntu yerlestirildi.')
    }
  }

  const handleImagePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const url = URL.createObjectURL(file)
    setPendingImageUrl(url)
    selectMarkupPlace('ann-image', 'image')
  }

  const handleAudioPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPendingAudioUrl(URL.createObjectURL(file))
    selectMarkupPlace('ann-audio', 'audio')
    notify('Ses notunu yerlestirmek icin cizime dokunun.')
  }

  const handleVideoPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPendingVideoUrl(URL.createObjectURL(file))
    selectMarkupPlace('ann-video', 'video')
    notify('Video notunu yerlestirmek icin cizime dokunun.')
  }

  const placeTextNote = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pendingText) return
    const point = resolveSketchPoint(event.clientX, event.clientY)
    if (!point) return
    event.stopPropagation()
    setTextNotes((current) => [
      ...current,
      {
        id: `txt-${Date.now()}`,
        point,
        text: pendingText,
        color: activeMarkupColor,
        height: appSettings.textHeight,
      },
    ])
    setPendingText(null)
    notify('Metin yerlestirildi.')
  }

  const updateAppSettings = (next: AppSettings) => {
    setAppSettings(next)
    saveSettings(next)
  }

  const handleOpenRecent = async (entry: RecentFileEntry) => {
    setFileBusy(true)
    setOpenStatus('Son dosya yukleniyor...')
    try {
      const file = await loadCachedFile(entry.id)
      if (!file) {
        setError('Dosya onbellekte yok. Lutfen yeniden secin.')
        return
      }
      await openFromFile(file, entry.source, true, `Son dosyalar > ${entry.name}`)
    } catch {
      setError('Son acilan dosya yuklenemedi.')
    } finally {
      setFileBusy(false)
    }
  }

  const fileInfoText = () => {
    if (!openedFile) {
      return `Demo cizim\nKatman: ${layerList.length}\nOlcum: ${measureRecords.length}`
    }

    return [
      `Dosya: ${openedFile.name}`,
      `Tur: ${openedFile.format.toUpperCase()}`,
      `Kaynak: ${sourceLabel(openedFile.source)}`,
      openedPath ? `Yol: ${openedPath}` : undefined,
      `Boyut: ${formatBytes(openedFile.size)}`,
      openedFile.entities ? `Nesne: ${openedFile.entities.length}` : undefined,
      openedFile.message,
      `Surum: ${APP_VERSION}`,
      `Olcum: ${measureRecords.length}`,
    ].filter(Boolean).join('\n')
  }

  const exportWorkspace = (kind: 'save' | 'export') => {
    const payload = {
      file: openedFile
        ? {
            name: openedFile.name,
            format: openedFile.format,
            source: openedFile.source,
            size: openedFile.size,
            message: openedFile.message,
          }
        : { name: 'Demo drawing', format: 'demo' },
      unitLabel,
      unitsPerDrawingUnit,
      hiddenLayers: [...hiddenLayers],
      activeMarkupColor,
      measurements: measureRecords,
      sketches: sketchShapes,
      comments,
    }

    if (kind === 'save' && measureRecords.length) {
      downloadTextFile(`olcumler-${Date.now()}.csv`, recordsToCsv(measureRecords), 'text/csv')
      notify('Olcumler CSV olarak kaydedildi.')
      return
    }

    downloadTextFile(`dwg-viewer-${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json')
    notify(kind === 'save' ? 'Cizim durumu kaydedildi.' : 'Cizim bilgileri disa aktarildi.')
  }

  const printDrawing = () => {
    if (window.DwgNative?.print) {
      window.DwgNative.print()
      notify('Yazdirma ekrani aciliyor.')
      return
    }

    window.print()
    notify('Yazdirma komutu gonderildi.')
  }

  const addComment = () => {
    const text = window.prompt('Yorum metni')
    const trimmed = text?.trim()
    if (!trimmed) return

    setComments((current) => [
      {
        id: `${Date.now()}-${current.length}`,
        text: trimmed,
        color: activeMarkupColor,
        createdAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      },
      ...current,
    ])
    notify('Yorum eklendi.')
  }

  const handleToolbarAction = (action: ToolbarAction) => {
    if (action === 'open') {
      handlePickDevice()
      return
    }

    if (action === 'zoomIn') {
      viewportRef.current?.zoomIn()
      return
    }

    if (action === 'fit') {
      viewportRef.current?.fit()
      return
    }

    if (action === 'print') {
      printDrawing()
      return
    }

    if (action === 'save') {
      exportWorkspace('save')
      return
    }

    if (action === 'undo') {
      if (draftSketchShape) {
        setDraftSketchShape(null)
        notify('Cizim taslagi silindi.')
        return
      }

      if (sketchShapes.length) {
        setSketchShapes((current) => current.slice(0, -1))
        notify('Son cizim geri alindi.')
        return
      }

      if (numberMarkers.length) {
        setNumberMarkers((current) => current.slice(0, -1))
        notify('Son numara geri alindi.')
        return
      }

      if (mediaMarkers.length) {
        setMediaMarkers((current) => current.slice(0, -1))
        notify('Son isaret geri alindi.')
        return
      }

      if (draftPoints.length) {
        setDraftPoints((current) => current.slice(0, -1))
        notify('Son olcum noktasi geri alindi.')
        return
      }

      if (measureRecords.length) {
        setMeasureRecords((current) => {
          const removed = current.at(-1)
          if (removed) setRedoMeasureRecords((redo) => [...redo, removed])
          return current.slice(0, -1)
        })
        notify('Son olcum geri alindi.')
        return
      }

      notify('Geri alinacak islem yok.')
      return
    }

    if (action === 'redo') {
      if (!redoMeasureRecords.length) {
        notify('Yinelenecek islem yok.')
        return
      }

      setRedoMeasureRecords((current) => {
        const restored = current.at(-1)
        if (restored) setMeasureRecords((records) => [...records, restored])
        return current.slice(0, -1)
      })
      notify('Olcum yeniden eklendi.')
    }
  }

  const handleMenuAction = (action: MenuAction) => {
    if (action === 'viewMode') {
      togglePerformanceMode()
    } else if (action === 'fileInfo') {
      window.alert(fileInfoText())
    } else if (action === 'export') {
      setExportOpen(true)
    } else if (action === 'help') {
      window.alert('CAD gorunumunde iki parmakla yakinlastirabilir, surukleyerek gezebilir ve alt olcum araclariyla mesafe/alan/nokta olcebilirsiniz.')
    } else if (action === 'toggleAnnotations') {
      setHiddenLayers((current) => {
        const next = new Set(current)
        if (next.has('TEXT')) {
          next.delete('TEXT')
          notify('Notasyonlar gosterildi.')
        } else {
          next.add('TEXT')
          notify('Notasyonlar gizlendi.')
        }
        return next
      })
    } else if (action === 'measureResults') {
      setMeasureOverlaysHidden((hidden) => {
        notify(hidden ? 'Olcum sonuclari gosterildi.' : 'Olcum sonuclari gizlendi.')
        return !hidden
      })
    } else if (action === 'regen') {
      viewportRef.current?.fit()
      setDraftPoints([])
      setSnapPreview(null)
      notify('Cizim yenilendi.')
    } else if (action === 'open') {
      handlePickDevice()
    } else if (action === 'settings') {
      setSettingsPanelOpen((open) => !open)
      notify('Yakalama ayarlari acildi.')
    }

    setMenuOpen(false)
  }

  const handleBottomAction = (action: BottomAction) => {
    setActiveBottomAction(action)

    if (action === 'layers') {
      setDrawModeOpen(false)
      setDraftSketchShape(null)
      setMeasurePanelOpen(false)
      setSettingsPanelOpen(false)
      setCommentsPanelOpen(false)
      setColorPanelOpen(false)
      setLayersPanelOpen((open) => !open)
      return
    }

    if (action === 'measureList') {
      setDrawModeOpen(false)
      setDraftSketchShape(null)
      setLayersPanelOpen(false)
      setSettingsPanelOpen(false)
      setCommentsPanelOpen(false)
      setColorPanelOpen(false)
      setMeasurePanelOpen((open) => !open)
      return
    }

    if (action === 'quickMeasure') {
      setDrawModeOpen(false)
      setDraftSketchShape(null)
      setLayersPanelOpen(false)
      setMeasurePanelOpen(false)
      setSettingsPanelOpen(false)
      setCommentsPanelOpen(false)
      setColorPanelOpen(false)
      if (!activeMeasureMode) selectMeasureMode('distance')
      return
    }

    if (action === 'comments') {
      setDrawModeOpen(false)
      setDraftSketchShape(null)
      setLayersPanelOpen(false)
      setMeasurePanelOpen(false)
      setSettingsPanelOpen(false)
      setColorPanelOpen(false)
      setCommentsPanelOpen((open) => !open)
      return
    }

    if (action === 'color') {
      setLayersPanelOpen(false)
      setMeasurePanelOpen(false)
      setSettingsPanelOpen(false)
      setCommentsPanelOpen(false)
      setColorPanelOpen((open) => !open)
      return
    }

    if (action === 'draw') {
      setActiveMeasureMode(null)
      setActiveMeasureActionId(null)
      setCommentsPanelOpen(false)
      setColorPanelOpen(false)
      setLayersPanelOpen(false)
      setMeasurePanelOpen(false)
      setSettingsPanelOpen(false)
      setActiveCategory('draw')
      if (!drawModeOpen) {
        selectDrawTool('draw-sketch')
      } else {
        setDrawModeOpen(false)
        setActiveDrawActionId(null)
        notify('Cizim modu kapatildi.')
      }
    } else if (action === 'note') {
      setDrawModeOpen(false)
      setActiveDrawActionId(null)
      setDraftSketchShape(null)
      setCommentsPanelOpen(true)
      addComment()
    }
  }

  return (
    <main className={`dwg-shell theme-${appSettings.theme}${lowPerf ? ' perf-low' : ''}`} aria-label="DWG FastView">
      <input
        ref={imageInputRef}
        className="file-input"
        type="file"
        accept="image/*"
        onChange={handleImagePick}
      />
      <input ref={audioInputRef} className="file-input" type="file" accept="audio/*" onChange={handleAudioPick} />
      <input ref={videoInputRef} className="file-input" type="file" accept="video/*" onChange={handleVideoPick} />
      <input
        ref={inputRef}
        className="file-input"
        type="file"
        accept=".dwg,.dxf,.dwf,.pdf,application/pdf,application/acad,application/autocad_dwg,application/dwg,application/dxf,application/dwf,application/octet-stream,application/x-acad,application/x-autocad,application/x-dwg,application/x-dxf,application/x-dwf,image/vnd.dwg,image/vnd.dxf"
        onChange={handleFileChange}
      />

      {screen === 'home' ? (
        <>
          <FastViewHome
            recentFiles={recentList}
            onOpenFile={() => setOpenPanelOpen(true)}
            onOpenRecent={handleOpenRecent}
            onToggleFavorite={(entry) => {
              toggleRecentFavorite(entry.id)
              setRecentList(listRecentFiles())
            }}
            onOpenSample={(format) => {
              void openSample(format)
            }}
            onEnterViewer={enterViewer}
          />
          {openPanelOpen && (
            <OpenFilesPanel
              busy={fileBusy}
              statusMessage={openStatus || undefined}
              onClose={() => {
                if (!fileBusy) setOpenPanelOpen(false)
              }}
              onPickDevice={handlePickDevice}
              onPickCloud={handlePickCloud}
              onOpenRecent={handleOpenRecent}
            />
          )}
        </>
      ) : (
      <section
        className="viewer fv-viewer mobile-viewer"
        style={
          {
            '--markup-color': activeMarkupColor,
            '--fv-chrome-bottom': chromeBottom,
            '--fv-top-chrome': '88px',
          } as CSSProperties
        }
      >

        <FastViewTopBar
          menuOpen={menuOpen}
          onClose={exitViewer}
          onAction={handleTopBarAction}
          onTextStyle={() => {
            setSettingsPanelOpen(true)
            notify('Metin yuksekligi ayarlardan degisir.')
          }}
        />

        {menuOpen && (
          <FastViewOverflowMenu
            items={menuItems.map(({ icon, label, action }) => ({ id: action, label, icon }))}
            onSelect={(id) => handleMenuAction(id as MenuAction)}
          />
        )}

        <div className="cad-stage">
          <DrawingViewport
            resetKey={viewportResetKey}
            actionsRef={viewportRef}
            panLocked={!!activeMeasureMode || drawModeOpen || !!activeEditTool || !!markupPlaceMode}
            onViewportChange={setViewport}
          >
            {(camera) => {
              const overlayTransform = dxfTransform ? applyCamera(dxfTransform, camera) : undefined
              return (
            <div className="viewport-content" ref={contentRef}>
              {openedFile?.format === 'pdf' && openedFile.url ? (
                <iframe className="pdf-frame" title={openedFile.name} src={openedFile.url} />
              ) : canvasEntities.length ? (
                <CadCanvas
                  entities={canvasEntities}
                  hiddenLayers={hiddenLayers}
                  theme={appSettings.theme}
                  viewWidth={viewSize.width}
                  viewHeight={viewSize.height}
                  bounds={sceneBounds}
                  camera={camera}
                  showLineweights={appSettings.showLineweights}
                />
              ) : (
                <div className="native-format-card">
                  <FileText size={36} />
                  <strong>{error ? 'Dosya acilamadi' : 'Cizim yok'}</strong>
                  <span>{error || 'Dosya acin veya Ornekler sekmesinden bir plan yukleyin.'}</span>
                </div>
              )}

              <SavedMeasuresLayer
                records={measureRecords}
                coordMode={coordMode}
                dxfTransform={overlayTransform}
                hidden={measureOverlaysHidden}
              />
              <MarkupLayer
                numbers={numberMarkers}
                media={mediaMarkers}
                texts={textNotes}
                coordMode={coordMode}
                dxfTransform={overlayTransform}
                onSelectMedia={setMediaPreview}
              />
              <SketchLayer
                shapes={sketchShapes}
                draftShape={draftSketchShape}
                coordMode={coordMode}
                dxfTransform={overlayTransform}
              />
              <MeasureOverlay
                mode={activeMeasureMode}
                draftPoints={draftPoints}
                snapPreview={snapPreview}
                coordMode={coordMode}
                dxfTransform={overlayTransform}
                hint={measureHint}
              />
              {zoomWindowMode && (
                <div
                  className="draw-capture"
                  onPointerDown={(event) => {
                    zoomDrag.current = { x1: event.clientX, y1: event.clientY, x2: event.clientX, y2: event.clientY }
                  }}
                  onPointerUp={(event) => {
                    const start = zoomDrag.current
                    zoomDrag.current = null
                    const host = contentRef.current?.closest('.viewport-host')
                    if (!start || !(host instanceof HTMLElement)) return
                    const bounds = host.getBoundingClientRect()
                    viewportRef.current?.zoomToScreenRect({
                      x1: start.x1 - bounds.left,
                      y1: start.y1 - bounds.top,
                      x2: event.clientX - bounds.left,
                      y2: event.clientY - bounds.top,
                    })
                    setZoomWindowMode(false)
                  }}
                >
                  <span className="draw-hint">Pencere</span>
                </div>
              )}
              {pendingText && (
                <div className="draw-capture" onPointerDown={placeTextNote}>
                  <span className="draw-hint">Metin</span>
                </div>
              )}
              {activeMeasureMode && (
                <div
                  className="measure-capture"
                  onPointerDown={handleMeasurePointerDown}
                  onPointerMove={handleMeasurePointerMove}
                />
              )}
              {activeEditTool && (
                <div className="draw-capture edit-capture" onPointerDown={handleEditPointerDown}>
                  <span className="draw-hint">{EDIT_LABELS[activeEditTool]}</span>
                </div>
              )}
              {markupPlaceMode && (
                <div className="draw-capture markup-capture" onPointerDown={handleMarkupPointerDown}>
                  <span className="draw-hint">
                    {markupPlaceMode === 'number'
                      ? 'Numara'
                      : markupPlaceMode === 'image'
                        ? 'Goruntu'
                        : markupPlaceMode === 'audio'
                          ? 'Ses'
                          : 'Video'}
                  </span>
                </div>
              )}
              {drawModeOpen && (
                <div
                  className="draw-capture"
                  onPointerDown={handleDrawPointerDown}
                  onPointerMove={handleDrawPointerMove}
                  onPointerUp={handleDrawPointerEnd}
                  onPointerCancel={handleDrawPointerEnd}
                >
                  <span className="draw-hint">{DRAW_LABELS[activeDrawTool]}</span>
                </div>
              )}
            </div>
              )
            }}
          </DrawingViewport>

          {error && <div className="file-error">{error}</div>}

          {measurePanelOpen && (
            <MeasureResultsPanel
              records={measureRecords}
              unitLabel={unitLabel}
              unitsPerDrawingUnit={unitsPerDrawingUnit}
              onDelete={(id) => setMeasureRecords((current) => current.filter((record) => record.id !== id))}
              onClear={() => setMeasureRecords([])}
              onClose={() => setMeasurePanelOpen(false)}
              onCalibrate={() => selectMeasureMode('calibration')}
            />
          )}

          {settingsPanelOpen && (
            <SettingsPanel
              settings={appSettings}
              pro={pro}
              onChange={updateAppSettings}
              onClose={() => setSettingsPanelOpen(false)}
              onUpgrade={() => setUpgradeOpen(true)}
              onPrivacy={() => setPrivacyOpen(true)}
            />
          )}

          {layersPanelOpen && (
            <LayerPanel
              layers={layerList}
              hiddenLayers={hiddenLayers}
              entityCounts={entityCounts}
              onToggle={toggleLayer}
              onShowAll={showAllLayers}
              onHideAll={hideAllLayers}
              onClose={() => setLayersPanelOpen(false)}
            />
          )}

          {commentsPanelOpen && (
            <CommentsPanel
              comments={comments}
              color={activeMarkupColor}
              onAdd={addComment}
              onDelete={(id) => setComments((current) => current.filter((comment) => comment.id !== id))}
              onClose={() => setCommentsPanelOpen(false)}
            />
          )}

          {colorModalOpen && (
            <FastViewColorModal
              color={activeMarkupColor}
              colorMode={colorMode}
              onSelectColor={(color) => {
                setActiveMarkupColor(color)
                setColorMode('aci')
              }}
              onSelectMode={(mode) => setColorMode(mode)}
              onClose={() => {
                setColorModalOpen(false)
                setActiveCategory(null)
              }}
              onConfirm={() => {
                notify(
                  colorMode === 'byLayer'
                    ? 'Renk ByLayer olarak ayarlandi.'
                    : colorMode === 'byBlock'
                      ? 'Renk ByBlock olarak ayarlandi.'
                      : 'Renk guncellendi.',
                )
                setColorModalOpen(false)
              }}
            />
          )}

          {colorPanelOpen && (
            <ColorPalettePanel
              color={activeMarkupColor}
              onSelect={(color) => {
                setActiveMarkupColor(color)
                notify('Renk paleti guncellendi.')
              }}
              onClose={() => setColorPanelOpen(false)}
            />
          )}
        </div>

        {(activeMeasureMode || measurePanelOpen || settingsPanelOpen) && (
          <SnapPanel settings={appSettings.snap} activeKind={snapPreview?.kind ?? null} onChange={updateSnapSettings} />
        )}

        <FastViewBottomStack
          activeCategory={activeCategory}
          activeActionId={fastViewActiveActionId}
          onCategorySelect={handleCategorySelect}
          onSubAction={handleFastViewSubAction}
        />

        {notice && <div className="app-notice" role="status">{notice}</div>}

        {!online && <p className="offline-banner">Offline mod: acilan dosyalar ve onbellek calisir.</p>}
      </section>
      )}

      {upgradeOpen && (
        <UpgradeSheet
          busy={upgradeBusy}
          priceLabel={priceLabel}
          error={upgradeError}
          onClose={() => setUpgradeOpen(false)}
          onPurchase={() => {
            void buyPro()
          }}
          onRestore={() => {
            void handleRestorePro()
          }}
        />
      )}

      {exportOpen && (
        <div className="upgrade-sheet" role="dialog" aria-label="Disa aktar">
          <div className="upgrade-card">
            <h2>Disa aktar</h2>
            <p className="upgrade-note">{pro ? 'Filigransiz PDF veya gorsel.' : 'Ucretsiz planda kucuk bir filigran eklenir.'}</p>
            <div className="upgrade-actions">
              <button type="button" onClick={() => { setExportOpen(false); void shareDrawing('pdf') }}>PDF</button>
              <button type="button" onClick={() => { setExportOpen(false); void shareDrawing('png') }}>Gorsel</button>
              <button type="button" className="upgrade-dismiss" onClick={() => setExportOpen(false)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {privacyOpen && (
        <div className="upgrade-sheet" role="dialog" aria-label="Gizlilik">
          <div className="upgrade-card">
            <h2>Gizlilik</h2>
            <p className="upgrade-note">
              Cizimler cihazinizda acilir. Son dosyalar yalnizca bu uygulamada saklanir. Bulut hesaplari ancak siz baglarsaniz kullanilir.
              Satin alma kaydi Google Play tarafindan tutulur. Konum, rehber veya reklam kimligi toplanmaz.
            </p>
            <div className="upgrade-actions">
              <button type="button" onClick={() => setPrivacyOpen(false)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {mediaPreview && (
        <div className="upgrade-sheet" role="dialog" aria-label="Isaret">
          <div className="upgrade-card">
            <h2>{mediaPreview.label}</h2>
            {mediaPreview.imageUrl && <img src={mediaPreview.imageUrl} alt="" className="media-preview" />}
            {mediaPreview.audioUrl && <audio controls src={mediaPreview.audioUrl} />}
            {mediaPreview.videoUrl && <video controls src={mediaPreview.videoUrl} className="media-preview" />}
            {!mediaPreview.imageUrl && !mediaPreview.audioUrl && !mediaPreview.videoUrl && (
              <p className="upgrade-note">Bu isaretin medya dosyasi yok.</p>
            )}
            <div className="upgrade-actions">
              <button type="button" onClick={() => setMediaPreview(null)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'viewer' && openPanelOpen && (
        <OpenFilesPanel
          busy={fileBusy}
          statusMessage={openStatus || undefined}
          onClose={() => {
            if (!fileBusy) setOpenPanelOpen(false)
          }}
          onPickDevice={handlePickDevice}
          onPickCloud={handlePickCloud}
          onOpenRecent={handleOpenRecent}
        />
      )}
    </main>
  )
}

export default App
