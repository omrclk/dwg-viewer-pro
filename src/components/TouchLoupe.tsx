import { useEffect, useRef } from 'react'

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
    ctx.fillRect(0, 0, 112, 112)
    ctx.drawImage(source, sx - 28, sy - 28, 56, 56, 0, 0, 112, 112)
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
  return <canvas ref={ref} className="touch-loupe" width={112} height={112} style={{ left: x - 56, top: Math.max(8, y - 148) }} aria-hidden="true" />
}