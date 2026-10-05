import { useEffect, useRef } from 'react'
import type { DrawingEntity } from '../drawingTypes'
import type { Bounds } from '../dxfTransform'
import { renderScene, type SceneTheme } from '../cad/renderScene'

export function CadCanvas({
  entities,
  hiddenLayers,
  theme,
  viewWidth,
  viewHeight,
  bounds,
  viewScale = 1,
}: {
  entities: DrawingEntity[]
  hiddenLayers: Set<string>
  theme: SceneTheme
  viewWidth: number
  viewHeight: number
  bounds?: Bounds | null
  viewScale?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || viewWidth < 2 || viewHeight < 2) return
    const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1))
    const width = Math.max(1, Math.floor(viewWidth * ratio))
    const height = Math.max(1, Math.floor(viewHeight * ratio))
    canvas.width = width
    canvas.height = height
    canvas.style.width = `${Math.round(viewWidth)}px`
    canvas.style.height = `${Math.round(viewHeight)}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    renderScene(ctx, {
      entities,
      hiddenLayers,
      width,
      height,
      viewWidth,
      viewHeight,
      theme,
      bounds,
      viewScale,
    })
  }, [bounds, entities, hiddenLayers, theme, viewScale, viewWidth, viewHeight])

  return <canvas ref={canvasRef} className="cad-canvas" aria-label="Cizim" />
}
