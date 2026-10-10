import { describe, expect, it } from 'vitest'
import { fileTitle, formatCadVersion, formatTurkishDateTime, originLabel, sniffDrawingVersion } from './fileListFormat'

describe('file list labels', () => {
  it('formats dates as day.month.year hour:minute', () => {
    expect(formatTurkishDateTime('2026-10-10T21:51:00')).toBe('10.10.2026 21:51')
  })

  it('keeps the extension when the name is shortened', () => {
    const name = 'ET_11_YILDIRIM_KORUNMA_SISTEMI_GENEL_YERLESIM_PLANI.dwg'
    const title = fileTitle(name, 40)
    expect(title.ext).toBe('.dwg')
    expect(title.text.endsWith('.dwg') || title.ext === '.dwg').toBe(true)
    expect(`${title.text}${title.ext}`.includes('.dwg')).toBe(true)
    expect(`${title.text}${title.ext}`.length).toBeLessThan(name.length)
    expect(fileTitle('ornek-plan.dwg').text).toBe('ornek-plan.dwg')
  })

  it('names AutoCAD versions from the header and the parser', () => {
    expect(sniffDrawingVersion(new TextEncoder().encode('AC1032rest'), 'dwg')).toBe('AutoCAD 2018')
    expect(formatCadVersion('2018', 'dwg')).toBe('AutoCAD 2018')
    expect(formatCadVersion('DXF', 'dxf')).toBe('DXF')
  })

  it('reads the source from the path', () => {
    expect(originLabel('device', 'WhatsApp > plan.dwg')).toBe('WhatsApp')
    expect(originLabel('device', 'Örnekler > örnek-plan.dwg')).toBe('Örnekler')
    expect(originLabel('device', 'Sistem seçici > plan.dwg')).toBe('Sistem seçici')
    expect(originLabel('google-drive')).toBe('Google Drive')
    expect(originLabel('device', undefined, 'Cihaz')).toBe('Cihaz')
  })
})
