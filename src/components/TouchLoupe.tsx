import { useEffect, useRef } from 'react'

const SIZE = 112

/** Place the loupe beside the finger, inside the canvas, clear of the top bar and bottom chrome. */
export function loupeBox(x: number, y: number, bounds?: { top: number; right: number; bottom: number; left: number }) {
  const gap = 36
  const edge = 8
  const topLimit = bounds?.top ?? 96
  const bottomLimit = bounds?.bottom ?? window.innerHeight - 120
  const leftLimit = bounds?.left ?? edge
  const rightLimit = bounds?.right ?? window.innerWidth - edge
  let left = x - SIZE - gap
  if (left < leftLimit) left = x + gap
  if (left + SIZE > rightLimit) left = Math.max(leftLimit, rightLimit - SIZE)
  let top = y - SIZE - gap
  if (top < topLimit) top = y + gap
  if (top + SIZE > bottomLimit) top = Math.max(topLimit, bottomLimit - SIZE)
  return { left, top }
}

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
