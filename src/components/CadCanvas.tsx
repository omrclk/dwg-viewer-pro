import { useEffect, useRef } from 'react'
import type { DrawingEntity } from '../drawingTypes'
import { renderScene, type SceneTheme } from '../cad/renderScene'

export function CadCanvas({
  entities,
  hiddenLayers,
  theme,
  viewWidth,
  viewHeight,
}: {
  entities: DrawingEntity[]
  hiddenLayers: Set<string>
  theme: SceneTheme
  viewWidth: number
  viewHeight: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || viewWidth < 2 || viewHeight < 2) return
    const ratio = Math.min(2.5, Math.max(1, window.devicePixelRatio || 1))
    const width = Math.max(1, Math.floor(viewWidth * ratio))
    const height = Math.max(1, Math.floor(viewHeight * ratio))
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
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
    })
  }, [entities, hiddenLayers, theme, viewWidth, viewHeight])

  return <canvas ref={canvasRef} className="cad-canvas" aria-label="Cizim" />
}
