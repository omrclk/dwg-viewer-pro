import type { Point2 } from './measureMath'

export type NumberMarker = {
  id: string
  number: number
  point: Point2
  color: string
}

export type MediaMarker = {
  id: string
  kind: 'audio' | 'video' | 'image'
  point: Point2
  label: string
  color: string
  imageUrl?: string
  audioUrl?: string
  videoUrl?: string
}

export type TextNote = {
  id: string
  point: Point2
  text: string
  color: string
  height: number
}

export function nextNumber(markers: NumberMarker[]) {
  if (!markers.length) return 1
  return Math.max(...markers.map((marker) => marker.number)) + 1
}
