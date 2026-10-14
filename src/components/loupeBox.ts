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

export const LOUPE_SIZE = SIZE
