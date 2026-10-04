import type { DrawingEntity } from './drawingTypes'

function getNumber(entity: Array<[string, string]>, code: string) {
  const match = entity.find(([group]) => group === code)
  return match ? Number.parseFloat(match[1]) : 0
}

function getString(entity: Array<[string, string]>, code: string, fallback = '0') {
  const match = entity.find(([group]) => group === code)
  const value = match?.[1]?.trim()
  return value || fallback
}

function getAllNumbers(entity: Array<[string, string]>, code: string) {
  return entity.filter(([group]) => group === code).map(([, value]) => Number.parseFloat(value))
}

export function parseDxfEntities(text: string): DrawingEntity[] {
  const rows = text.replace(/\r/g, '').split('\n').map((row) => row.trim())
  const pairs: Array<[string, string]> = []

  for (let index = 0; index < rows.length - 1; index += 2) {
    pairs.push([rows[index], rows[index + 1]])
  }

  const entities: DrawingEntity[] = []
  let index = 0

  while (index < pairs.length) {
    const [code, value] = pairs[index]

    if (code !== '0') {
      index += 1
      continue
    }

    const entityType = value.toUpperCase()
    const entity: Array<[string, string]> = []
    index += 1

    while (index < pairs.length && pairs[index][0] !== '0') {
      entity.push(pairs[index])
      index += 1
    }

    const layer = getString(entity, '8')

    if (entityType === 'LINE') {
      entities.push({
        type: 'line',
        layer,
        x1: getNumber(entity, '10'),
        y1: getNumber(entity, '20'),
        x2: getNumber(entity, '11'),
        y2: getNumber(entity, '21'),
      })
    }

    if (entityType === 'CIRCLE') {
      entities.push({
        type: 'circle',
        layer,
        cx: getNumber(entity, '10'),
        cy: getNumber(entity, '20'),
        r: Math.max(0.01, getNumber(entity, '40')),
      })
    }

    if (entityType === 'ARC') {
      entities.push({
        type: 'arc',
        layer,
        cx: getNumber(entity, '10'),
        cy: getNumber(entity, '20'),
        r: Math.max(0.01, getNumber(entity, '40')),
        start: getNumber(entity, '50'),
        end: getNumber(entity, '51'),
      })
    }

    if (entityType === 'LWPOLYLINE' || entityType === 'POLYLINE') {
      const xs = getAllNumbers(entity, '10')
      const ys = getAllNumbers(entity, '20')
      const points = xs.map((x, pointIndex) => ({ x, y: ys[pointIndex] ?? 0 }))
      const flags = getNumber(entity, '70')

      if (points.length > 1) {
        entities.push({ type: 'polyline', layer, points, closed: (flags & 1) === 1 })
      }
    }
  }

  return entities.slice(0, 500)
}
