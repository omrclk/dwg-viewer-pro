import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readDrawingBytes } from './readDrawing'

const sampleDir = join(process.cwd(), 'fixtures/acadsharp')
const sampleFiles = readdirSync(sampleDir).filter((name) => name.endsWith('.dwg')).sort()

describe('real ACadSharp DWG samples', () => {
  it('vendors at least one sample', () => {
    expect(sampleFiles.length).toBeGreaterThan(0)
  })

  it.each(sampleFiles)('%s renders entities', async (name) => {
    const bytes = new Uint8Array(readFileSync(join(sampleDir, name)))
    const drawing = await readDrawingBytes(bytes, 'dwg')
    const count = drawing.layouts.reduce((sum, layout) => sum + layout.entities.length, 0)
    expect(drawing.version.length).toBeGreaterThan(0)
    expect(count).toBeGreaterThan(0)
  })
})
