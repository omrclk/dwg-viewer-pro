import { useEffect, useRef } from 'react'
import { LOUPE_SIZE, loupeBox } from './loupeBox'

const SIZE = LOUPE_SIZE

export function TouchLoupe({ x, y, visible }: { x: number; y: number; visible: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!visible) return
    const source = document.querySelector('canvas.cad-canvas')
    const node = ref.current
    if (!(source instanceof HTMLCanvasElement) || !node) return
    const ctx = node.getContext('2d')
    if (!ctx) return
    const rect = source.getBoundingClientRect()
    const scaleX = source.width / Math.max(1, rect.width)
    const scaleY = source.height / Math.max(1, rect.height)
    const sx = (x - rect.left) * scaleX
    const sy = (y - rect.top) * scaleY
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#0b0d0d'
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.drawImage(source, sx - 28, sy - 28, 56, 56, 0, 0, SIZE, SIZE)
    ctx.strokeStyle = '#18f4ea'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(56, 46)
    ctx.lineTo(56, 66)
    ctx.moveTo(46, 56)
    ctx.lineTo(66, 56)
    ctx.stroke()
  }, [visible, x, y])

  if (!visible) return null
  const stage = document.querySelector('.cad-stage')
  const rect = stage instanceof HTMLElement ? stage.getBoundingClientRect() : undefined
  let top = rect ? rect.top + 8 : 96
  let bottom = rect ? rect.bottom - 8 : window.innerHeight - 120
  if (rect) {
    for (const sel of ['.measure-hint', '.draw-hint']) {
      const hint = document.querySelector(sel)
      if (hint instanceof HTMLElement) top = Math.max(top, hint.getBoundingClientRect().bottom + 8)
    }
    for (const sel of ['.snap-panel', '.measure-results-panel', '.layers-panel', '.settings-panel', '.fv-sub-panel', '.color-panel', '.comments-panel']) {
      const panel = document.querySelector(sel)
      if (!(panel instanceof HTMLElement)) continue
      const panelRect = panel.getBoundingClientRect()
      if (panelRect.height > 4) bottom = Math.min(bottom, panelRect.top - 8)
    }
  }
  const box = loupeBox(
    x,
    y,
    rect ? { top, right: rect.right - 8, bottom, left: rect.left + 8 } : undefined,
  )
  return <canvas ref={ref} className="touch-loupe" width={SIZE} height={SIZE} style={{ left: box.left, top: box.top }} aria-hidden="true" />
}
