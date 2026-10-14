import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  ArrowUpToLine,
  Box,
  CircleHelp,
  EyeOff,
  FileText,
  FolderOpen,
  RefreshCw,
  Ruler,
  Settings,
} from 'lucide-react'
import '../App.css'
import '../fastview/fastview.css'
import { pickFileFromSource, type CloudProvider } from '../cloud'
import type { DrawingEntity } from '../drawingTypes'
import { buildOpenedFile } from '../fileOpenService'
import type { FileSource, OpenedFile, RecentFileEntry } from '../fileTypes'
import { formatBytes, sourceLabel } from '../fileTypes'
import { listRecentFiles, loadCachedFile } from '../recentFiles'
import { boundsForEntities, buildDxfTransform } from '../dxfTransform'
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
} from '../drawTools'
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
} from '../editTools'
import { nextNumber, type MediaMarker, type NumberMarker, type TextNote } from '../markupTools'
import { buildMeasureRecord, calibrationFactor, canFinalize } from '../measureActions'
import type { MeasureRecord, Point2 } from '../measureMath'
import { distance, downloadTextFile, recordsToCsv } from '../measureMath'
import { type MeasureMode } from '../MeasureOverlay'
import { findNearestEntity } from '../entityPick'
import { screenToWorldPoint } from '../screenToWorld'
import { DEMO_SNAP_POINTS } from '../demoSnapPoints'
import { collectSnapTargets, findNearestSnap, snapToleranceInCoords } from '../snapEngine'
import { entityRenderLimit, loadSettings, resolvePerformanceMode, saveSettings, type AppSettings, type SnapKind } from '../settings'
import { loadWorkspace, saveWorkspace } from '../workspaceStore'
import { nearestMarkup, translatePoint, type MarkupHit } from '../markupHit'
import type { MainCategory } from '../fastview/menuConfig'
import { subMenuRows } from '../fastview/menuConfig'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { VIEW_BOX } from '../dxfTransform'
import { type ViewportHandle, type ViewportState } from '../viewer/DrawingViewport'
import { type CommentRecord } from '../viewer/ViewerPanels'
import { FREE_MEASURE_LIMIT } from '../billing/products'
import { loadEntitlement, loadProProduct, purchasePro, restorePro as restoreProPurchase, verifyEntitlementOnStartup } from '../billing/entitlement'
import { claimExternalFile, fileFromPayload, type ExternalFilePayload } from '../fileOpen/externalFile'
import { exportDrawingPdf, exportDrawingPng } from '../exportShare'
import { SUB_MENUS } from '../fastview/menuConfig'
import { APP_VERSION } from '../version'

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
    __dwgOnBack?: () => boolean
  }
}

const VIP_ACTIONS = new Set(
  Object.values(SUB_MENUS).flatMap((items) => items.filter((item) => item.vip).map((item) => item.id)),
)

export type ToolbarAction = 'open' | 'save' | 'undo' | 'redo' | 'print' | 'zoomIn' | 'fit'
export type MenuAction = 'viewMode' | 'fileInfo' | 'export' | 'help' | 'toggleAnnotations' | 'measureResults' | 'regen' | 'open' | 'settings'
export type MeasureSession = 'normal' | 'continuous' | 'batch' | 'entity' | 'radius' | 'diameter'
export type MarkupPlaceMode = 'number' | 'image' | 'audio' | 'video' | null


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


const MEASURE_HINTS: Record<Exclude<MeasureMode, null>, string> = {
  distance: 'Mesafe için iki nokta seçin',
  area: 'Alan için köşe noktaları seçin, bitirmek için çift dokunun',
  angle: 'Açı için: başlangıç, tepe, bitiş noktası',
  arc: 'Yay: merkez, başlangıç, bitiş noktası',
  point: 'Koordinat okumak için nokta seçin',
  calibration: 'Kalibrasyon: bilinen mesafenin iki uçunu seçin',
}


const LOADING_STATUS = /(?:açılıyor|hazırlanıyor|yükleniyor|bağlanıyor)\.\.\.$/

function isLoadingStatus(message: string) {
  return LOADING_STATUS.test(message)
}

export function useCadController() {
  const inputRef = useRef<HTMLInputElement>(null)
  const lastUrlRef = useRef<string | null>(null)
  const viewportRef = useRef<ViewportHandle | null>(null)
  const pastEdits = useRef<string[]>([])
  const futureEdits = useRef<string[]>([])
  const historyLock = useRef(true)
  const lastEditSnap = useRef('')
  const loadedWorkspaceKey = useRef('')
  const pressTimer = useRef<number | null>(null)
  const pressMenu = useRef(false)
  const fingerDown = useRef(false)
  const finishedDrawId = useRef('')
  const pendingCallout = useRef<string | null>(null)
  const moveHit = useRef<MarkupHit | null>(null)
  const moveLast = useRef<Point2 | null>(null)
  const [loupe, setLoupe] = useState<{ x: number; y: number } | null>(null)
  const [moving, setMoving] = useState(false)
  const [objectMenu, setObjectMenu] = useState<{ x: number; y: number; hit: MarkupHit | null } | null>(null)
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
  const [resultsExpanded, setResultsExpanded] = useState(false)
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
  const [draftPoints, setDraftPoints] = useState<Point2[]>([])
  const [draftSketchShape, setDraftSketchShape] = useState<SketchShape | null>(null)
  const [measureRecords, setMeasureRecords] = useState<MeasureRecord[]>([])
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
  const [pro, setPro] = useState(() => (Capacitor.isNativePlatform() ? loadEntitlement().pro : false))
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [upgradeBusy, setUpgradeBusy] = useState(false)
  const [upgradeError, setUpgradeError] = useState('')
  const [priceLabel, setPriceLabel] = useState('Google Play fiyatı')
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
  const openedName = openedFile?.name
  const openedSize = openedFile?.size
  const openedFormat = openedFile?.format
  const openedLayout = openedFile?.layoutName

  const dxfEntities = openedFile && openedFile.format !== 'pdf' ? openedFile.entities : undefined
  const layerList = useMemo(() => {
    const base = dxfEntities?.length ? layersFromEntities(dxfEntities) : []
    return [...new Set([...base, ...customLayers])].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [customLayers, dxfEntities])
  const layerColors = useMemo(() => {
    const colors = new Map<string, string>()
    openedFile?.document?.layers.forEach((layer) => {
      if (layer.color) colors.set(layer.name, layer.color)
    })
    dxfEntities?.forEach((entity) => {
      if (entity.color && !colors.has(entity.layer)) colors.set(entity.layer, entity.color)
    })
    return colors
  }, [dxfEntities, openedFile?.document?.layers])
  const entityCounts = useMemo(
    () => (dxfEntities?.length ? countEntitiesByLayer(dxfEntities) : new Map<string, number>()),
    [dxfEntities],
  )

  const visibleDxfEntities = useMemo(
    () => (dxfEntities ?? []).filter((entity) => !hiddenLayers.has(entity.layer)),
    [dxfEntities, hiddenLayers],
  )
  const coordMode: 'dxf' | 'demo' = visibleDxfEntities.length ? 'dxf' : 'demo'
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
    if (fileBusy) return
    setOpenStatus((current) => (isLoadingStatus(current) ? '' : current))
  }, [fileBusy])

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
  }, [openedLayout, openedName, screen])

  useEffect(() => {
    void verifyEntitlementOnStartup().then((entitlement) => setPro(entitlement.pro))
    void loadProProduct().then((product) => {
      if (product?.priceString) setPriceLabel(product.priceString)
    })
  }, [])

  const notify = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice((current) => (current === message ? '' : current)), 1100)
  }, [])

  const viewerRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const root = viewerRef.current
    if (!root) return
    const chrome = Number.parseFloat(getComputedStyle(root).getPropertyValue('--fv-chrome-bottom')) || 54
    const view = root.getBoundingClientRect()
    let lift = 0
    for (const el of root.querySelectorAll(
      '.measure-results-panel, .layers-panel, .settings-panel, .comments-panel, .color-panel, .snap-panel',
    )) {
      const rect = el.getBoundingClientRect()
      if (rect.height < 8 || rect.width < 8) continue
      const needed = view.bottom - rect.top - chrome - 4
      if (needed > lift) lift = needed
    }
    root.style.setProperty('--toast-lift', `${Math.max(0, Math.round(lift))}px`)
  }, [
    screen,
    notice,
    measurePanelOpen,
    resultsExpanded,
    layersPanelOpen,
    settingsPanelOpen,
    commentsPanelOpen,
    colorPanelOpen,
    activeMeasureMode,
    activeCategory,
    menuOpen,
  ])

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
    notify(nextMode === 'low' ? 'Düşük performans modu açıldı.' : 'Yüksek kalite modu açıldı.')
  }

  useEffect(() => {
    historyLock.current = true
    pastEdits.current = []
    futureEdits.current = []
    lastEditSnap.current = ''
    loadedWorkspaceKey.current = ''
    const key = openedName ? `${openedName}::${openedSize ?? 0}` : ''
    const saved = openedName ? loadWorkspace(openedName, openedSize ?? 0) : null
    setHiddenLayers(new Set(saved?.hiddenLayers ?? []))
    setLayersPanelOpen(false)
    setMeasurePanelOpen(false)
    setResultsExpanded(false)
    setSettingsPanelOpen(false)
    setCommentsPanelOpen(false)
    setColorPanelOpen(false)
    setDrawModeOpen(false)
    setActiveMeasureMode(null)
    setActiveMeasureActionId(null)
    setDraftPoints([])
    setDraftSketchShape(null)
    setMeasureRecords((saved?.measures as MeasureRecord[]) ?? [])
    setSketchShapes((saved?.sketches as SketchShape[]) ?? [])
    setMeasureSession('normal')
    setMeasureOverlaysHidden(false)
    setActiveDrawTool('sketch')
    setActiveDrawActionId(null)
    setActiveEditTool(null)
    setActiveEditActionId(null)
    setMarkupPlaceMode(null)
    setActiveMarkupActionId(null)
    setNumberMarkers((saved?.numbers as NumberMarker[]) ?? [])
    setMediaMarkers([])
    setPendingImageUrl(null)
    setTextNotes((saved?.notes as TextNote[]) ?? [])
    setComments((saved?.comments as CommentRecord[]) ?? [])
    setUnitsPerDrawingUnit(saved?.unitsPerDrawingUnit && saved.unitsPerDrawingUnit > 0 ? saved.unitsPerDrawingUnit : 0.01)
    setUnitLabel(saved?.unitLabel || 'm')
    setCustomLayers([])
    loadedWorkspaceKey.current = key
    const unlock = window.setTimeout(() => {
      historyLock.current = false
    }, 0)
    return () => window.clearTimeout(unlock)
  }, [openedFormat, openedName, openedSize])

  useEffect(() => {
    const snap = JSON.stringify({ sketchShapes, measureRecords, textNotes, numberMarkers, comments, unitsPerDrawingUnit, unitLabel })
    if (historyLock.current) {
      lastEditSnap.current = snap
      return
    }
    if (!lastEditSnap.current) {
      lastEditSnap.current = snap
      return
    }
    if (snap === lastEditSnap.current) return
    pastEdits.current.push(lastEditSnap.current)
    if (pastEdits.current.length > 40) pastEdits.current.shift()
    futureEdits.current = []
    lastEditSnap.current = snap
  }, [comments, measureRecords, numberMarkers, sketchShapes, textNotes, unitLabel, unitsPerDrawingUnit])

  useEffect(() => {
    if (!openedName || openedSize === undefined) return
    const key = `${openedName}::${openedSize}`
    if (loadedWorkspaceKey.current !== key) return
    saveWorkspace(openedName, openedSize, {
      sketches: sketchShapes,
      measures: measureRecords,
      notes: textNotes,
      numbers: numberMarkers,
      comments,
      hiddenLayers: [...hiddenLayers],
      unitsPerDrawingUnit,
      unitLabel,
    })
  }, [comments, hiddenLayers, measureRecords, numberMarkers, openedName, openedSize, sketchShapes, textNotes, unitLabel, unitsPerDrawingUnit])

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
    setActiveCategory(null)
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
    setActiveCategory(null)
    editTargetRef.current = null
    notify(`${EDIT_LABELS[tool]}: ${EDIT_HINTS[tool]}`)
    return true
  }

  const selectMarkupPlace = (actionId: string, mode: MarkupPlaceMode) => {
    closeInteractionModes()
    setMarkupPlaceMode(mode)
    setActiveMarkupActionId(actionId)
    setActiveCategory(null)
    if (mode === 'number') notify('Numaralandırma: konuma dokunun.')
    if (mode === 'audio') notify('Ses notu: konuma dokunun.')
    if (mode === 'video') notify('Video notu: konuma dokunun.')
    if (mode === 'image') notify('Görüntü: konuma dokunun.')
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
      setActiveCategory(null)
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
        `Çizim mesafesi ${drawingDistance.toFixed(3)} birim. Gerçek mesafe?`,
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
      notify(`Ücretsiz planda ${FREE_MEASURE_LIMIT} ölçüm sınırı doldu.`)
      return
    }

    const record = buildMeasureRecord(mode, points, unitsPerDrawingUnit, unitLabel, {
      label:
        measureSession === 'radius' ? 'Yarıçap' : measureSession === 'diameter' ? 'Çap' : undefined,
      decimals: appSettings.measureDecimals,
    })
    if (record) {
      setMeasureRecords((current) => [...current, record])
      setResultsExpanded(false)
      setMeasurePanelOpen(true)
      setLoupe(null)
    }
    if (mode !== 'area' && measureSession === 'normal') {
      setActiveMeasureMode(null)
      setActiveMeasureActionId(null)
    }
  }

  const handleMeasurePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activeMeasureMode || !contentRef.current) return
    event.stopPropagation()
    fingerDown.current = true
    setLoupe({ x: event.clientX, y: event.clientY })

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
        notify('Yakın varlık bulunamadı.')
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
      notify(`${hit.kind} seçildi (${hit.layer}).`)
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
    setResultsExpanded(false)
    setSettingsPanelOpen(false)
    setCommentsPanelOpen(false)
    setColorPanelOpen(false)
    setMenuOpen(false)
  }

  const handleFastViewSubAction = (actionId: string) => {
    if (VIP_ACTIONS.has(actionId) && !pro) {
      setUpgradeOpen(true)
      notify('Bu araç Pro kilidinde.')
      return
    }
    if (actionId === 'ann-text' || actionId === 'draw-text') {
      const text = window.prompt('Çizime eklenecek metin')
      const trimmed = text?.trim()
      if (!trimmed) return
      setPendingText(trimmed)
      setMarkupPlaceMode(null)
      setDrawModeOpen(false)
      setActiveCategory(null)
      notify('Metni yerleştirmek için çizime dokunun.')
      return
    }
    if (actionId === 'layer-list') {
      setActiveCategory(null)
      setLayersPanelOpen(true)
      notify('Katman listesi açıldı.')
      return
    }
    if (actionId === 'layer-all-on') {
      showAllLayers()
      notify('Tüm katmanlar açıldı.')
      return
    }
    if (actionId === 'layer-off') {
      setLayersPanelOpen(true)
      const target = layerList.find((layer) => !hiddenLayers.has(layer))
      if (target) toggleLayer(target)
      notify(target ? `${target} katmanı kapatıldı.` : 'Kapatılacak katman yok.')
      return
    }
    if (actionId === 'layer-isolate') {
      const target = layerList.find((layer) => !hiddenLayers.has(layer))
      if (!target) return
      layerSnapshotRef.current = new Set(hiddenLayers)
      setHiddenLayers(new Set(layerList.filter((layer) => layer !== target)))
      notify(`${target} katmanı izole edildi.`)
      return
    }
    if (actionId === 'layer-previous') {
      if (!layerSnapshotRef.current) {
        notify('Önceki katman durumu yok.')
        return
      }
      setHiddenLayers(new Set(layerSnapshotRef.current))
      layerSnapshotRef.current = null
      notify('Önceki katman durumu yüklendi.')
      return
    }
    if (actionId === 'layer-new') {
      const name = window.prompt('Yeni katman adi')
      const trimmed = name?.trim()
      if (!trimmed) return
      setCustomLayers((current) => [...new Set([...current, trimmed])])
      notify(`${trimmed} katmanı eklendi.`)
      return
    }
    if (actionId === 'layer-default') {
      const name = window.prompt('Varsayilan katman', defaultLayer)
      const trimmed = name?.trim()
      if (!trimmed) return
      setDefaultLayer(trimmed)
      notify(`${trimmed} varsayılan katman yapıldı.`)
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
      setActiveCategory(null)
      setResultsExpanded(true)
      setMeasurePanelOpen(true)
      notify('Ölçüm sonuçları listelendi.')
      return
    }
    if (actionId === 'measure-count') {
      setActiveCategory(null)
      setResultsExpanded(true)
      setMeasurePanelOpen(true)
      notify(`${measureRecords.length} ölçüm kaydı var.`)
      return
    }
    if (actionId === 'measure-precision') {
      setSettingsPanelOpen(true)
      notify('Hassasiyet ayarları açıldı.')
      return
    }
    if (actionId === 'measure-continuous') {
      selectMeasureMode('distance', 'continuous', actionId)
      notify('Sürekli ölçüm: noktalar arası mesafeler zincirlenir.')
      return
    }
    if (actionId === 'measure-facade') {
      selectMeasureMode('area', 'normal', actionId)
      notify('Cephe ölçümü: alan için köşe noktaları seçin.')
      return
    }
    if (actionId === 'measure-batch') {
      selectMeasureMode('distance', 'batch', actionId)
      notify('Toplu ölçüm: her iki noktada bir kayıt oluşturulur.')
      return
    }
    if (actionId === 'measure-entity') {
      selectMeasureMode('point', 'entity', actionId)
      notify('Varlık: çizim üzerinde bir nesne seçin.')
      return
    }

    if (actionId === 'dim-linear') {
      selectMeasureMode('distance', 'normal', actionId)
      notify('Doğrusal boyut ölçümü başladı.')
      return
    }
    if (actionId === 'dim-aligned') {
      selectMeasureMode('distance', 'normal', actionId)
      notify('Hizalı boyut ölçümü başladı.')
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
      notify('Yarıçap ölçümü: merkez ve kenar noktası seçin.')
      return
    }
    if (actionId === 'dim-diameter') {
      selectMeasureMode('distance', 'diameter', actionId)
      notify('Çap ölçümü: iki uç nokta seçin.')
      return
    }

    if (actionId === 'ann-leader' || actionId === 'draw-multileader') {
      const text = window.prompt('Gösterge metni', 'Not')?.trim()
      pendingCallout.current = text || null
      if (selectDrawTool(actionId)) {
        notify(text ? 'Gösterge: oku çizin, metin başlangıca yazılır.' : 'Ok: başlangıçtan hedefe sürükleyin.')
      }
      return
    }
    if (actionIdToDrawTool(actionId)) {
      pendingCallout.current = null
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
      pendingCallout.current = null
      if (selectDrawTool('draw-sketch')) return
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
  }

  const handleTopBarAction = (action: 'save' | 'undo' | 'redo' | 'layout' | 'zoomWindow' | 'fit' | 'menu') => {
    if (action === 'menu') {
      setMeasurePanelOpen(false)
      setResultsExpanded(false)
      setMenuOpen((open) => !open)
      return
    }
    if (action === 'layout') {
      const layouts = openedFile?.document?.layouts ?? []
      if (layouts.length < 2) {
        if (document.fullscreenElement) {
          void document.exitFullscreen()
          notify('Tam ekran kapandı.')
        } else {
          void document.documentElement.requestFullscreen?.()
          notify('Tam ekran açıldı.')
        }
        return
      }
      const current = openedFile?.layoutName ?? 'Model'
      const index = layouts.findIndex((layout) => layout.name === current)
      const next = layouts[(index + 1) % layouts.length]
      setOpenedFile((file) => (file ? { ...file, entities: next.entities, layoutName: next.name, summary: `${next.entities.length} varlık · ${next.name}` } : file))
      notify(`${next.name} düzeni açıldı.`)
      return
    }
    if (action === 'zoomWindow') {
      setZoomWindowMode((current) => !current)
      notify(zoomWindowMode ? 'Pencere yakınlaştırma kapandı.' : 'Yakınlaştırılacak alanı sürükleyin.')
      return
    }
    handleToolbarAction(action)
  }

  const shareDrawing = async (kind: 'png' | 'pdf') => {
    const entities = openedFile?.entities
    if (!entities?.length) {
      notify('Dışa aktarılacak çizim yok.')
      return
    }
    try {
      const base = (openedFile?.name ?? 'cizim').replace(/\.[^.]+$/, '')
      const watermark = pro ? null : 'DWG Viewer'
      const markup = { sketches: sketchShapes, measures: measureRecords, notes: textNotes }
      if (kind === 'pdf') await exportDrawingPdf(entities, hiddenLayers, appSettings.theme, base, watermark, appSettings.showLineweights, markup)
      else await exportDrawingPng(entities, hiddenLayers, appSettings.theme, base, watermark, appSettings.showLineweights, markup)
      notify(kind === 'pdf' ? 'PDF paylaşıldı.' : 'Görsel paylaşıldı.')
    } catch (exportError) {
      notify(exportError instanceof Error ? exportError.message : 'Dışa aktarma başarısız.')
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
        notify('Pro açıldı.')
      }
    } catch (purchaseError) {
      setUpgradeError(purchaseError instanceof Error ? purchaseError.message : 'Satın alma tamamlanamadı.')
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
      notify(entitlement.pro ? 'Satın alma geri yüklendi.' : 'Geri yüklenecek satın alma yok.')
      if (entitlement.pro) setUpgradeOpen(false)
    } catch (restoreError) {
      setUpgradeError(restoreError instanceof Error ? restoreError.message : 'Geri yükleme başarısız.')
    } finally {
      setUpgradeBusy(false)
    }
  }

  const openSample = async (format: 'dwg' | 'dxf') => {
    setFileBusy(true)
    setOpenStatus('Örnek plan hazırlanıyor...')
    try {
      if (format === 'dwg') {
        const { sampleDwgBytes } = await import('../cad/samplePlan')
        const bytes = sampleDwgBytes()
        const file = new File([bytes], 'ornek-plan.dwg', { type: 'application/octet-stream' })
        await openFromFile(file, 'device', false, 'Örnekler > örnek-plan.dwg')
        return
      }
      const { SAMPLE_RICH_DXF } = await import('../cad/samplePlan')
      const file = new File([SAMPLE_RICH_DXF], 'ornek-plan.dxf', { type: 'application/dxf' })
      await openFromFile(file, 'device', false, 'Örnekler > örnek-plan.dxf')
    } catch (sampleError) {
      setError(sampleError instanceof Error ? sampleError.message : 'Örnek çizim açılamadı.')
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
    setFileBusy(false)
    setOpenStatus((current) => (isLoadingStatus(current) ? '' : current))
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
  const resultsLift = measurePanelOpen ? (resultsExpanded ? 280 : 64) : 0
  const snapLift = activeMeasureMode && !resultsExpanded ? 96 : 0

  const applyOpenResult = (result: Awaited<ReturnType<typeof buildOpenedFile>>) => {
    if (result.ok === false) {
      setError(result.error)
      setOpenStatus(result.error)
      if (screen === 'viewer') setOpenPanelOpen(true)
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

  const openFromFile = async (file: File, source: FileSource, skipRecent = false, sourcePath?: string, origin?: string) => {
    setFileBusy(true)
    setOpenStatus('Dosya açılıyor...')
    try {
      const result = await buildOpenedFile(file, source, { skipRecent, sourcePath, origin })
      applyOpenResult(result)
      if (result.ok) {
        setOpenedPath(sourcePath || `${sourceLabel(source)} > ${file.name}`)
      }
    } catch {
      setError('Dosya açılırken hata oluştu.')
      setOpenStatus('Dosya açılırken hata oluştu.')
    } finally {
      setFileBusy(false)
    }
  }

  const openFromFileRef = useRef(openFromFile)
  openFromFileRef.current = openFromFile
  const notifyRef = useRef(notify)
  notifyRef.current = notify

  useEffect(() => {
    const handleExternalFile = async (event: Event) => {
      const detail = (event as CustomEvent<ExternalFilePayload>).detail
      if (!detail || !claimExternalFile(detail.id)) return

      setError('')
      setOpenPanelOpen(false)

      try {
        const file = fileFromPayload(detail)
        await openFromFileRef.current(file, 'device', false, detail.sourcePath || `Paylaşım > ${file.name}`)
        notifyRef.current('Paylaşılan dosya açıldı.')
      } catch (openError) {
        const message = openError instanceof Error ? openError.message : 'Dosya açılamadı.'
        setOpenedFile(null)
        setScreen('viewer')
        setError(message)
      }
    }

    const handleExternalError = (event: Event) => {
      const detail = (event as CustomEvent<ExternalFilePayload>).detail
        setOpenedFile(null)
        setScreen('viewer')
        setError(detail?.message || 'Dosya açılamadı.')
    }

    window.addEventListener('dwg-viewer-open-file', handleExternalFile)
    window.addEventListener('dwg-viewer-open-error', handleExternalError)

    return () => {
      window.removeEventListener('dwg-viewer-open-file', handleExternalFile)
      window.removeEventListener('dwg-viewer-open-error', handleExternalError)
    }
  }, [])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('stress') !== '1') return
    let cancelled = false
    void import('../cad/stressPlan').then(({ buildStressPlan }) => {
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
    window.__dwgOnBack = () => {
      if (moving) {
        moveHit.current = null
        moveLast.current = null
        setMoving(false)
        return true
      }
      if (objectMenu) {
        setObjectMenu(null)
        return true
      }
      if (openPanelOpen) {
        setOpenPanelOpen(false)
        setFileBusy(false)
        setOpenStatus('')
        return true
      }
      if (upgradeOpen) {
        setUpgradeOpen(false)
        return true
      }
      if (menuOpen || layersPanelOpen || measurePanelOpen || settingsPanelOpen || commentsPanelOpen || colorPanelOpen || colorModalOpen || exportOpen || privacyOpen) {
        setMenuOpen(false)
        setLayersPanelOpen(false)
        setMeasurePanelOpen(false)
        setSettingsPanelOpen(false)
        setCommentsPanelOpen(false)
        setColorPanelOpen(false)
        setColorModalOpen(false)
        setExportOpen(false)
        setPrivacyOpen(false)
        setActiveCategory(null)
        return true
      }
      if (pendingText) {
        setPendingText(null)
        return true
      }
      if (activeMeasureMode || drawModeOpen || activeEditTool || markupPlaceMode || zoomWindowMode) {
        setActiveMeasureMode(null)
        setDrawModeOpen(false)
        setActiveEditTool(null)
        setMarkupPlaceMode(null)
        setZoomWindowMode(false)
        setDraftPoints([])
        setDraftSketchShape(null)
        return true
      }
      if (screen === 'viewer') {
        exitViewer()
        return true
      }
      return false
    }
    return () => {
      delete window.__dwgOnBack
    }
  })

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('stress') !== '1') return
    window.__dwgViewer = {
      zoomIn: () => viewportRef.current?.zoomIn(),
      zoomOut: () => viewportRef.current?.zoomOut(),
      fit: () => viewportRef.current?.fit(),
    }
  }, [screen, viewportResetKey])

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await openFromFile(file, 'device', false, `Telefon dosyaları > ${file.name}`)
  }

  const handlePickDevice = async (explicitOrigin?: string) => {
    setFileBusy(true)
    setOpenStatus('')
    try {
      const file = await pickFileFromSource('device')
      const origin = typeof explicitOrigin === 'string' ? explicitOrigin : 'Cihaz'
      await openFromFile(file, 'device', false, `${origin} > ${file.name}`, origin)
    } catch (pickError) {
      const message = pickError instanceof Error ? pickError.message : 'Dosya seçilemedi'
      if (message.toLocaleLowerCase('tr').includes('seçilmedi') || message.toLocaleLowerCase('tr').includes('secilmedi') || message.toLocaleLowerCase('tr').includes('iptal')) {
        setOpenStatus('Seçim iptal edildi. Yeniden deneyebilirsiniz.')
        if (screen === 'viewer') setOpenPanelOpen(true)
      } else setError(message)
    } finally {
      setFileBusy(false)
    }
  }

  const handlePickCloud = async (provider: CloudProvider) => {
    setFileBusy(true)
    setOpenStatus(`${provider} bağlanıyor...`)
    setError('')
    try {
      const file = await pickFileFromSource(provider)
      await openFromFile(file, provider, false, `${sourceLabel(provider)} > ${file.name}`)
    } catch (pickError) {
      const message = pickError instanceof Error ? pickError.message : 'Bulut dosyası açılamadı'
      if (message.includes('.env') || message.includes('API')) {
        setOpenStatus(message)
      } else if (!message.toLocaleLowerCase('tr').includes('iptal') && !message.toLocaleLowerCase('tr').includes('seçilmedi') && !message.toLocaleLowerCase('tr').includes('secilmedi')) {
        setError(message)
      }
    } finally {
      setFileBusy(false)
    }
  }

  const handleMeasurePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activeMeasureMode || !contentRef.current || !fingerDown.current) return
    if (snapRafRef.current) return
    setLoupe({ x: event.clientX, y: event.clientY })
    snapRafRef.current = window.requestAnimationFrame(() => {
      snapRafRef.current = null
      resolveMeasurePoint(event.clientX, event.clientY)
    })
  }

  const resolveSketchPoint = (clientX: number, clientY: number) => resolveMeasurePoint(clientX, clientY)

  const openObjectMenu = (clientX: number, clientY: number) => {
    const point = resolveSketchPoint(clientX, clientY)
    const tolerance = contentRef.current
      ? snapToleranceInCoords(viewport.scale, contentRef.current.clientHeight, VIEW_BOX.height, 36)
      : 24
    const hit = point ? nearestMarkup(point, tolerance, sketchShapes, measureRecords, textNotes) : null
    setObjectMenu({ x: clientX, y: clientY, hit })
    if (!hit) notify('Burada silinecek veya taşınacak nesne yok.')
  }

  const deleteMarkupHit = (hit: MarkupHit) => {
    if (hit.kind === 'sketch') setSketchShapes((current) => current.filter((shape) => shape.id !== hit.id))
    if (hit.kind === 'measure') setMeasureRecords((current) => current.filter((record) => record.id !== hit.id))
    if (hit.kind === 'note') setTextNotes((current) => current.filter((note) => note.id !== hit.id))
    setObjectMenu(null)
    notify('Nesne silindi.')
  }

  const beginMove = (hit: MarkupHit) => {
    moveHit.current = hit
    moveLast.current = null
    setMoving(true)
    setObjectMenu(null)
    setDrawModeOpen(false)
    setActiveMeasureMode(null)
    notify('Taşımak için nesneyi sürükleyin.')
  }

  const finalizeDrawShape = (shape: SketchShape) => {
    if (!canFinalizeDrawShape(shape.kind, shape.points)) return
    if (finishedDrawId.current === shape.id) return
    finishedDrawId.current = shape.id
    const stamped = { ...shape, strokeWidth: shape.strokeWidth ?? appSettings.markupStroke }
    setSketchShapes((current) => [...current, stamped])
    setDraftSketchShape(null)
    const callout = pendingCallout.current
    if (callout && stamped.kind === 'arrow' && stamped.points[0]) {
      pendingCallout.current = null
      setTextNotes((current) => [
        ...current,
        {
          id: `txt-${Date.now()}`,
          point: stamped.points[0],
          text: callout,
          color: stamped.color,
          height: appSettings.textHeight,
        },
      ])
    }
  }

  const applyEditSnap = (raw: string) => {
    const data = JSON.parse(raw) as {
      sketchShapes?: SketchShape[]
      measureRecords?: MeasureRecord[]
      textNotes?: TextNote[]
      numberMarkers?: NumberMarker[]
      comments?: CommentRecord[]
      unitsPerDrawingUnit?: number
      unitLabel?: string
    }
    historyLock.current = true
    setSketchShapes(data.sketchShapes ?? [])
    setMeasureRecords(data.measureRecords ?? [])
    setTextNotes(data.textNotes ?? [])
    setNumberMarkers(data.numberMarkers ?? [])
    setComments(data.comments ?? [])
    if (typeof data.unitsPerDrawingUnit === 'number' && data.unitsPerDrawingUnit > 0) setUnitsPerDrawingUnit(data.unitsPerDrawingUnit)
    if (data.unitLabel) setUnitLabel(data.unitLabel)
    lastEditSnap.current = raw
    window.setTimeout(() => {
      historyLock.current = false
    }, 0)
  }

  const undoEdit = () => {
    if (draftSketchShape) {
      setDraftSketchShape(null)
      notify('Çizim taslağı silindi.')
      return
    }
    if (draftPoints.length) {
      setDraftPoints((current) => current.slice(0, -1))
      notify('Son ölçüm noktası geri alındı.')
      return
    }
    const previous = pastEdits.current.pop()
    if (!previous) {
      notify('Geri alınacak işlem yok.')
      return
    }
    futureEdits.current.push(lastEditSnap.current)
    applyEditSnap(previous)
    notify('Geri alındı.')
  }

  const redoEdit = () => {
    const next = futureEdits.current.pop()
    if (!next) {
      notify('Yinelenecek işlem yok.')
      return
    }
    pastEdits.current.push(lastEditSnap.current)
    applyEditSnap(next)
    notify('Yinelendi.')
  }

  const handleDrawPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawModeOpen) return
    const point = resolveSketchPoint(event.clientX, event.clientY)
    if (!point) return

    event.stopPropagation()
    fingerDown.current = true
    setLoupe({ x: event.clientX, y: event.clientY })
    const pressX = event.clientX
    const pressY = event.clientY
    window.clearTimeout(pressTimer.current ?? undefined)
    pressMenu.current = false
    pressTimer.current = window.setTimeout(() => {
      pressMenu.current = true
      setLoupe(null)
      openObjectMenu(pressX, pressY)
    }, 560)

    if (isTapDrawTool(activeDrawTool)) {
      if (activeDrawTool === 'polyline' && event.detail >= 2) {
        const current = draftSketchShape
        setDraftSketchShape(null)
        if (current) finalizeDrawShape(current)
        return
      }

      const base = draftSketchShape ?? {
        id: `shape-${Date.now()}`,
        kind: activeDrawTool,
        color: activeMarkupColor,
        points: [] as Point2[],
      }
      const next = { ...base, points: [...base.points, point] }
      if (activeDrawTool === 'arc' && canFinalizeDrawShape('arc', next.points)) {
        setDraftSketchShape(null)
        finalizeDrawShape(next)
        return
      }
      setDraftSketchShape(next)
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
    if (!drawModeOpen || !draftSketchShape || !fingerDown.current) return
    window.clearTimeout(pressTimer.current ?? undefined)
    pressTimer.current = null
    setLoupe({ x: event.clientX, y: event.clientY })
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
    fingerDown.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setLoupe(null)
    window.clearTimeout(pressTimer.current ?? undefined)
    pressTimer.current = null
    if (pressMenu.current) {
      pressMenu.current = false
      return
    }
    if (!drawModeOpen || !draftSketchShape) return
    if (isTapDrawTool(activeDrawTool)) return

    event.preventDefault()
    event.stopPropagation()

    const shape = draftSketchShape
    setDraftSketchShape(null)
    if (shape) finalizeDrawShape(shape)
  }

  const handleMovePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = resolveSketchPoint(event.clientX, event.clientY)
    if (!point || !moveHit.current) return
    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    moveLast.current = point
    setLoupe({ x: event.clientX, y: event.clientY })
  }

  const handleMovePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const hit = moveHit.current
    const last = moveLast.current
    const point = resolveSketchPoint(event.clientX, event.clientY)
    if (!hit || !last || !point) return
    const dx = point.x - last.x
    const dy = point.y - last.y
    if (!dx && !dy) return
    moveLast.current = point
    setLoupe({ x: event.clientX, y: event.clientY })
    event.preventDefault()
    if (hit.kind === 'sketch') {
      setSketchShapes((current) =>
        current.map((shape) =>
          shape.id === hit.id ? { ...shape, points: shape.points.map((item) => translatePoint(item, dx, dy)) } : shape,
        ),
      )
    } else if (hit.kind === 'measure') {
      setMeasureRecords((current) =>
        current.map((record) =>
          record.id === hit.id ? { ...record, points: record.points.map((item) => translatePoint(item, dx, dy)) } : record,
        ),
      )
    } else {
      setTextNotes((current) =>
        current.map((note) => (note.id === hit.id ? { ...note, point: translatePoint(note.point, dx, dy) } : note)),
      )
    }
  }

  const handleMovePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    setLoupe(null)
    moveHit.current = null
    moveLast.current = null
    setMoving(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    notify('Nesne taşındı.')
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
        notify('Kırpılacak çizim bulunamadı.')
        return
      }
      setSketchShapes((current) => trimSketchShape(current, hit.id))
      notify('Seçili çizim silindi.')
      return
    }

    if (activeEditTool === 'extend') {
      if (!editTargetRef.current) {
        const hit = findNearestSketchShape(sketchShapes, point, tolerance)
        if (!hit || hit.kind !== 'line') {
          notify('Uzatılacak çizgi seçin.')
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
      notify('Çizgi uzatıldı.')
      return
    }

    if (activeEditTool === 'offset') {
      if (!editTargetRef.current) {
        const hit = findNearestSketchShape(sketchShapes, point, tolerance)
        if (!hit) {
          notify('Öteleme için şekil seçin.')
          return
        }
        editTargetRef.current = hit
        notify('Öteleme yönü için dokunun.')
        return
      }
      const offset = offsetSketchShape(editTargetRef.current, point)
      if (!offset) return
      setSketchShapes((current) => [...current, offset])
      editTargetRef.current = null
      notify('Öteleme kopyası oluşturuldu.')
      return
    }

    if (activeEditTool === 'fillet' || activeEditTool === 'chamfer') {
      const hit = findNearestSketchShape(sketchShapes, point, tolerance)
      if (!hit || hit.kind !== 'rect') {
        notify('Dikdörtgen seçin.')
        return
      }
      const size = Math.max(4, distance(hit.points[0], point) / 4)
      const next =
        activeEditTool === 'fillet' ? filletSketchShape(hit, size) : chamferSketchShape(hit, size)
      if (!next) return
      setSketchShapes((current) => current.map((shape) => (shape.id === next.id ? next : shape)))
      notify(activeEditTool === 'fillet' ? 'Köşe yuvarlatıldı.' : 'Köşe pahı uygulandı.')
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
      notify(markupPlaceMode === 'audio' ? 'Ses notu yerleştirildi.' : 'Video notu yerleştirildi.')
      return
    }

    if (markupPlaceMode === 'image' && pendingImageUrl) {
      setMediaMarkers((current) => [
        ...current,
        {
          id: `img-${Date.now()}`,
          kind: 'image',
          point,
          label: 'Görüntü',
          color: activeMarkupColor,
          imageUrl: pendingImageUrl,
        },
      ])
      notify('Görüntü yerleştirildi.')
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
    notify('Ses notunu yerleştirmek için çizime dokunun.')
  }

  const handleVideoPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPendingVideoUrl(URL.createObjectURL(file))
    selectMarkupPlace('ann-video', 'video')
    notify('Video notunu yerleştirmek için çizime dokunun.')
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
    notify('Metin yerleştirildi.')
  }

  const updateAppSettings = (next: AppSettings) => {
    setAppSettings(next)
    saveSettings(next)
  }

  const handleOpenRecent = async (entry: RecentFileEntry) => {
    setFileBusy(true)
    setOpenStatus('Son dosya yükleniyor...')
    try {
      const file = await loadCachedFile(entry.id)
      if (!file) {
        setOpenStatus('Dosya önbellekte yok. Yeniden seçebilirsiniz.')
        setOpenPanelOpen(true)
        setError('')
        return
      }
      await openFromFile(file, entry.source, true, `Son dosyalar > ${entry.name}`)
    } catch {
      setError('Son açılan dosya yüklenemedi.')
    } finally {
      setFileBusy(false)
    }
  }

  const fileInfoText = () => {
    if (!openedFile) {
      return `Demo çizim\nKatman: ${layerList.length}\nÖlçüm: ${measureRecords.length}`
    }

    return [
      `Dosya: ${openedFile.name}`,
      `Tur: ${openedFile.format.toUpperCase()}`,
      `Kaynak: ${sourceLabel(openedFile.source)}`,
      openedPath ? `Yol: ${openedPath}` : undefined,
      `Boyut: ${formatBytes(openedFile.size)}`,
      openedFile.entities ? `Nesne: ${openedFile.entities.length}` : undefined,
      openedFile.message,
      `Sürüm: ${APP_VERSION}`,
      `Ölçüm: ${measureRecords.length}`,
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

    downloadTextFile(`dwg-viewer-${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json')
    if (kind === 'save' && measureRecords.length) {
      downloadTextFile(`olcumler-${Date.now()}.csv`, recordsToCsv(measureRecords), 'text/csv')
    }
    notify(kind === 'save' ? 'İşaretler bu çizime kaydedildi.' : 'Çizim bilgileri dışa aktarıldı.')
  }

  const printDrawing = () => {
    if (window.DwgNative?.print) {
      window.DwgNative.print()
      notify('Yazdırma ekranı açılıyor.')
      return
    }

    window.print()
    notify('Yazdırma komutu gönderildi.')
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
      undoEdit()
      return
    }

    if (action === 'redo') {
      redoEdit()
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
      window.alert('CAD görünümünde iki parmakla yakınlaştırabilir, sürükleyerek gezebilir ve alt ölçüm araçlarıyla mesafe, alan ve nokta ölçebilirsiniz.')
    } else if (action === 'toggleAnnotations') {
      setHiddenLayers((current) => {
        const next = new Set(current)
        if (next.has('TEXT')) {
          next.delete('TEXT')
          notify('Notasyonlar gösterildi.')
        } else {
          next.add('TEXT')
          notify('Notasyonlar gizlendi.')
        }
        return next
      })
    } else if (action === 'measureResults') {
      setMeasureOverlaysHidden((hidden) => {
        notify(hidden ? 'Ölçüm sonuçları gösterildi.' : 'Ölçüm sonuçları gizlendi.')
        return !hidden
      })
    } else if (action === 'regen') {
      viewportRef.current?.fit()
      setDraftPoints([])
      setSnapPreview(null)
      notify('Çizim yenilendi.')
    } else if (action === 'open') {
      handlePickDevice()
    } else if (action === 'settings') {
      setSettingsPanelOpen((open) => !open)
      notify('Yakalama ayarları açıldı.')
    }

    setMenuOpen(false)
  }

  return {
    menuItems,
    inputRef,
    viewportRef,
    fingerDown,
    loupe,
    setLoupe,
    moving,
    objectMenu,
    setObjectMenu,
    openedFile,
    openPanelOpen,
    setOpenPanelOpen,
    fileBusy,
    setFileBusy,
    openStatus,
    setOpenStatus,
    error,
    setError,
    layersPanelOpen,
    setLayersPanelOpen,
    menuOpen,
    screen,
    recentList,
    setRecentList,
    activeCategory,
    setActiveCategory,
    colorModalOpen,
    setColorModalOpen,
    colorMode,
    setColorMode,
    hiddenLayers,
    measurePanelOpen,
    setMeasurePanelOpen,
    resultsExpanded,
    setResultsExpanded,
    measureOverlaysHidden,
    imageInputRef,
    audioInputRef,
    videoInputRef,
    settingsPanelOpen,
    setSettingsPanelOpen,
    commentsPanelOpen,
    setCommentsPanelOpen,
    colorPanelOpen,
    setColorPanelOpen,
    drawModeOpen,
    activeDrawTool,
    activeMeasureMode,
    draftPoints,
    draftSketchShape,
    measureRecords,
    setMeasureRecords,
    sketchShapes,
    activeEditTool,
    markupPlaceMode,
    numberMarkers,
    mediaMarkers,
    comments,
    setComments,
    activeMarkupColor,
    setActiveMarkupColor,
    notice,
    setViewport,
    unitsPerDrawingUnit,
    unitLabel,
    contentRef,
    appSettings,
    snapPreview,
    pro,
    upgradeOpen,
    setUpgradeOpen,
    upgradeBusy,
    upgradeError,
    priceLabel,
    viewSize,
    zoomWindowMode,
    setZoomWindowMode,
    textNotes,
    pendingText,
    privacyOpen,
    setPrivacyOpen,
    mediaPreview,
    setMediaPreview,
    exportOpen,
    setExportOpen,
    zoomDrag,
    online,
    lowPerf,
    viewportResetKey,
    layerList,
    layerColors,
    entityCounts,
    coordMode,
    sceneBounds,
    dxfTransform,
    canvasEntities,
    measureHint,
    notify,
    viewerRef,
    updateSnapSettings,
    selectMeasureMode,
    fastViewActiveActionId,
    handleMeasurePointerDown,
    toggleLayer,
    showAllLayers,
    hideAllLayers,
    handleFastViewSubAction,
    handleCategorySelect,
    handleTopBarAction,
    shareDrawing,
    buyPro,
    handleRestorePro,
    openSample,
    enterViewer,
    exitViewer,
    chromeBottom,
    resultsLift,
    snapLift,
    handleFileChange,
    handlePickDevice,
    handlePickCloud,
    handleMeasurePointerMove,
    openObjectMenu,
    deleteMarkupHit,
    beginMove,
    handleDrawPointerDown,
    handleDrawPointerMove,
    handleDrawPointerEnd,
    handleMovePointerDown,
    handleMovePointerMove,
    handleMovePointerEnd,
    handleEditPointerDown,
    handleMarkupPointerDown,
    handleImagePick,
    handleAudioPick,
    handleVideoPick,
    placeTextNote,
    updateAppSettings,
    handleOpenRecent,
    addComment,
    handleMenuAction,
  }
}
