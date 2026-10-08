import type { DrawingEntity } from '../drawingTypes'
import { viewBoxToWorld, type Bounds, type DxfTransform } from '../dxfTransform'

export type WorldBox = { minX: number; minY: number; maxX: number; maxY: number }

export function entityWorldBox(entity: DrawingEntity): WorldBox | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const add = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  if (entity.type === 'line') {
    add(entity.x1, entity.y1)
    add(entity.x2, entity.y2)
  } else if (entity.type === 'circle' || entity.type === 'arc') {
    add(entity.cx - entity.r, entity.cy - entity.r)
    add(entity.cx + entity.r, entity.cy + entity.r)
  } else if (entity.type === 'polyline' || entity.type === 'solid') {
    entity.points.forEach((point) => add(point.x, point.y))
  } else if (entity.type === 'text') {
    const height = entity.height > 0 ? entity.height : 1
    const width = Math.max(entity.boxWidth ?? 0, entity.text.length * height * 0.7, height)
    add(entity.x - width, entity.y - height)
    add(entity.x + width, entity.y + height)
  }
  if (!Number.isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}

export type SpatialIndex = {
  cell: number
  boxes: Array<WorldBox | null>
  buckets: Map<string, number[]>
  loose: number[]
}

export function buildSpatialIndex(entities: DrawingEntity[]): SpatialIndex {
  const boxes = entities.map((entity) => entityWorldBox(entity))
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  boxes.forEach((box) => {
    if (!box) return
    minX = Math.min(minX, box.minX)
    minY = Math.min(minY, box.minY)
    maxX = Math.max(maxX, box.maxX)
    maxY = Math.max(maxY, box.maxY)
  })
  const span = Math.max(maxX - minX, maxY - minY, 1)
  const cell = span / 48
  const buckets = new Map<string, number[]>()
  const loose: number[] = []
  boxes.forEach((box, index) => {
    if (!box) {
      loose.push(index)
      return
    }
    const x0 = Math.floor(box.minX / cell)
    const x1 = Math.floor(box.maxX / cell)
    const y0 = Math.floor(box.minY / cell)
    const y1 = Math.floor(box.maxY / cell)
    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        const key = `${x}:${y}`
        const list = buckets.get(key)
        if (list) list.push(index)
        else buckets.set(key, [index])
      }
    }
  })
  return { cell, boxes, buckets, loose }
}

function intersects(box: WorldBox, view: WorldBox) {
  return box.maxX >= view.minX && box.minX <= view.maxX && box.maxY >= view.minY && box.minY <= view.maxY
}

export function querySpatialIndex(index: SpatialIndex, view: WorldBox) {
  const cell = index.cell
  const x0 = Math.floor(view.minX / cell)
  const x1 = Math.floor(view.maxX / cell)
  const y0 = Math.floor(view.minY / cell)
  const y1 = Math.floor(view.maxY / cell)
  const seen = new Uint8Array(index.boxes.length)
  const hits: number[] = []
  const take = (entityIndex: number) => {
    if (seen[entityIndex]) return
    seen[entityIndex] = 1
    const box = index.boxes[entityIndex]
    if (!box || intersects(box, view)) hits.push(entityIndex)
  }
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      const list = index.buckets.get(`${x}:${y}`)
      if (!list) continue
      for (let indexInCell = 0; indexInCell < list.length; indexInCell += 1) take(list[indexInCell])
    }
  }
  index.loose.forEach(take)
  return hits
}

export function viewWorldBounds(transform: DxfTransform, padCss = 8): Bounds {
  const corners = [
    viewBoxToWorld(-padCss, -padCss, transform),
    viewBoxToWorld(transform.viewWidth + padCss, -padCss, transform),
    viewBoxToWorld(-padCss, transform.viewHeight + padCss, transform),
    viewBoxToWorld(transform.viewWidth + padCss, transform.viewHeight + padCss, transform),
  ]
  return corners.reduce(
    (box, point) => ({
      minX: Math.min(box.minX, point.x),
      minY: Math.min(box.minY, point.y),
      maxX: Math.max(box.maxX, point.x),
      maxY: Math.max(box.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  )
}
