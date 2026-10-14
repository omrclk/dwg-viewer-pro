import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { boundsForEntities, buildDxfTransform } from '../dxfTransform'
import { readDrawingBytes } from './readDrawing'

const file = join(process.cwd(), 'fixtures/user/user-plan.dwg')

function fold(value: string) {
  return value
    .toLocaleLowerCase('tr')
    .replaceAll('ı', 'i')
    .replaceAll('ş', 's')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
}

describe('user architectural plan', () => {
  it('draws entrance labels at true height and fits the plan on a phone', async () => {
    const bytes = new Uint8Array(readFileSync(file))
    expect(Buffer.from(bytes.subarray(0, 6)).toString('latin1')).toBe('AC1032')

    const drawing = await readDrawingBytes(bytes, 'dwg')
    const model = drawing.layouts.find((layout) => layout.isModel)
    expect(drawing.version).toBe('2018')
    expect(model?.entities.length).toBeGreaterThan(1000)

    const hidden = new Set(drawing.layers.filter((layer) => !layer.visible).map((layer) => layer.name))
    const visible = (model?.entities ?? []).filter((entity) => !hidden.has(entity.layer))
    const texts = visible.filter((entity) => entity.type === 'text')
    const entrance = texts.filter((entity) => fold(entity.text) === 'girisi' || fold(entity.text) === 'otopark')
    expect(entrance.length).toBeGreaterThan(0)
    entrance.forEach((entity) => {
      expect(entity.height).toBeGreaterThan(100)
      expect(entity.height).toBeLessThan(2000)
    })

    const bounds = boundsForEntities(visible, drawing.extents)
    expect(bounds.maxX - bounds.minX).toBeGreaterThan(500_000)
    const view = buildDxfTransform(bounds, 1080, 2340)
    const tallest = texts.reduce((max, entity) => Math.max(max, entity.height * view.scale), 0)
    const fitted = Math.max((bounds.maxX - bounds.minX) * view.scale, (bounds.maxY - bounds.minY) * view.scale)
    expect(tallest).toBeLessThan(80)
    expect(fitted).toBeGreaterThan(900)
  }, 90_000)
})
