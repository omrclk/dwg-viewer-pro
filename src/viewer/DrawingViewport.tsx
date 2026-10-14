import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { gestureDelta } from '../dxfTransform'

export type ViewportState = { scale: number; panX: number; panY: number }

const MIN_VIEW_SCALE = 0.2
const MAX_VIEW_SCALE = 256
const ZOOM_FACTOR = 1.22

function clampScale(scale: number) {
  return Math.min(MAX_VIEW_SCALE, Math.max(MIN_VIEW_SCALE, scale))
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

export type ViewportHandle = {
  zoomIn: () => void
  zoomOut: () => void
  fit: () => void
  zoomToScreenRect: (rect: { x1: number; y1: number; x2: number; y2: number }) => void
}

export function DrawingViewport({
  children,
  resetKey,
  actionsRef,
  panLocked = false,
  onViewportChange,
  onIdlePress,
}: {
  children: (camera: ViewportState) => ReactNode
  resetKey: string
  actionsRef: React.MutableRefObject<ViewportHandle | null>
  panLocked?: boolean
  onViewportChange?: (state: ViewportState) => void
  onIdlePress?: (clientX: number, clientY: number) => void
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
  const idleTimer = useRef<number | null>(null)
  const idleOrigin = useRef<{ x: number; y: number } | null>(null)

  const clearIdlePress = () => {
    window.clearTimeout(idleTimer.current ?? undefined)
    idleTimer.current = null
    idleOrigin.current = null
  }

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
    const origin = idleOrigin.current
    if (origin && (event.clientX - origin.x) ** 2 + (event.clientY - origin.y) ** 2 > 144) clearIdlePress()
    const session = panSession.current
    if (!session || session.pointerId !== event.pointerId) return
    setLive({
      scale: session.scale,
      panX: session.panX + (event.clientX - session.startX),
      panY: session.panY + (event.clientY - session.startY),
    })
  }

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    clearIdlePress()
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
    if (!panLocked && event.button === 0) {
      setIsPanning(true)
      idleOrigin.current = { x: event.clientX, y: event.clientY }
      window.clearTimeout(idleTimer.current ?? undefined)
      const pressX = event.clientX
      const pressY = event.clientY
      idleTimer.current = window.setTimeout(() => {
        idleOrigin.current = null
        onIdlePress?.(pressX, pressY)
      }, 560)
    }
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
      aria-label="Çizim alanı: sürükleyerek kaydırın, tekerlek veya iki parmakla yakınlaştırın"
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

