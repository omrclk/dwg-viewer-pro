import type { Point2 } from './measureMath'
import { VIEW_BOX, viewBoxToWorld, type buildDxfTransform } from './dxfTransform'

type ViewportState = { scale: number; panX: number; panY: number }
type DxfTransform = ReturnType<typeof buildDxfTransform>

export function screenToWorldPoint(
  clientX: number,
  clientY: number,
  contentEl: HTMLElement,
  viewport: ViewportState,
  coordMode: 'demo' | 'dxf',
  dxfTransform?: DxfTransform,
): Point2 | null {
  const host = contentEl.closest('.viewport-host') as HTMLElement | null
  if (!host) return null

  const hostRect = host.getBoundingClientRect()
  const localX = (clientX - hostRect.left - viewport.panX) / viewport.scale
  const localY = (clientY - hostRect.top - viewport.panY) / viewport.scale

  const width = contentEl.clientWidth || 1
  const height = contentEl.clientHeight || 1
  const viewX = (localX / width) * VIEW_BOX.width
  const viewY = (localY / height) * VIEW_BOX.height

  if (coordMode === 'dxf' && dxfTransform) {
    return viewBoxToWorld(viewX, viewY, dxfTransform)
  }

  return { x: viewX, y: viewY }
}
