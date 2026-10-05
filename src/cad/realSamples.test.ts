import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readDrawingBytes } from './readDrawing'

const sampleDir = '/tmp/dwg-samples'
const sampleFiles = existsSync(sampleDir) ? readdirSync(sampleDir).filter((name) => name.endsWith('.dwg')) : []

describe.skipIf(sampleFiles.length === 0)('real ACadSharp DWG samples', () => {
  const files = sampleFiles

  it.each(files)('%s renders entities', async (name) => {
    const bytes = new Uint8Array(readFileSync(join(sampleDir, name)))
    const drawing = await readDrawingBytes(bytes, 'dwg')
    const count = drawing.layouts.reduce((sum, layout) => sum + layout.entities.length, 0)
    console.log(`${name} version=${drawing.version} layouts=${drawing.layouts.map((layout) => `${layout.name}:${layout.entities.length}`).join(',')} warnings=${drawing.warnings.join(' | ')}`)
    expect(drawing.version.length).toBeGreaterThan(0)
    expect(count).toBeGreaterThan(0)
  })
})
