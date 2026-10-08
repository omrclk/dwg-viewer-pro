import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DrawingEntity } from '../drawingTypes'
import type { Bounds, ViewCamera } from '../dxfTransform'
import { renderScene, type SceneTheme } from '../cad/renderScene'
import { readDevicePixelRatio } from '../cad/hairline'
import { buildSpatialIndex } from '../cad/spatialIndex'

const IDENTITY_CAMERA: ViewCamera = { scale: 1, panX: 0, panY: 0 }

export function CadCanvas({
  entities,
  hiddenLayers,
  theme,
  viewWidth,
  viewHeight,
  bounds,
  camera = IDENTITY_CAMERA,
  showLineweights = false,
}: {
  entities: DrawingEntity[]
  hiddenLayers: Set<string>
  theme: SceneTheme
  viewWidth: number
  viewHeight: number
  bounds?: Bounds | null
  camera?: ViewCamera
  showLineweights?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dpr, setDpr] = useState(readDevicePixelRatio)
  const index = useMemo(() => (entities.length > 4000 ? buildSpatialIndex(entities) : undefined), [entities])
  const cameraScale = camera.scale
  const cameraPanX = camera.panX
  const cameraPanY = camera.panY

  useEffect(() => {
    const update = () => {
      const next = readDevicePixelRatio()
      setDpr((current) => (current === next ? current : next))
    }
    update()
    window.addEventListener('resize', update)
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', update)
    const timer = window.setTimeout(update, 280)
    return () => {
      window.removeEventListener('resize', update)
      viewport?.removeEventListener('resize', update)
      window.clearTimeout(timer)
    }
  }, [])

  useLayoutEffect(() => {
    const node = canvasRef.current
    if (!node || viewWidth < 2 || viewHeight < 2) return
    const ratio = dpr
    const width = Math.max(1, Math.floor(viewWidth * ratio))
    const height = Math.max(1, Math.floor(viewHeight * ratio))
    if (node.width !== width) node.width = width
    if (node.height !== height) node.height = height
    node.style.width = `${viewWidth}px`
    node.style.height = `${viewHeight}px`
    const ctx = node.getContext('2d', { alpha: false, willReadFrequently: true })
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    renderScene(ctx, {
      entities,
      hiddenLayers,
      width,
      height,
      viewWidth,
      viewHeight,
      theme,
      bounds,
      camera: { scale: cameraScale, panX: cameraPanX, panY: cameraPanY },
      showLineweights,
      dpr: ratio,
      index,
    })
  }, [bounds, cameraPanX, cameraPanY, cameraScale, dpr, entities, hiddenLayers, index, showLineweights, theme, viewWidth, viewHeight])

  return <canvas ref={canvasRef} data-dpr={dpr} className="cad-canvas" aria-label="Cizim" />
}
