import { describe, expect, it } from 'vitest'
import { claimExternalFile, EXTERNAL_FILE_DEDUPE_MS, fileFromPayload, resetExternalFileClaims } from './externalFile'

describe('external file open dedupe', () => {
  it('claims an id once inside the native retry window and allows it again later', () => {
    resetExternalFileClaims()
    const now = 1_700_000_000_000
    expect(claimExternalFile('paylasim:plan.dwg:1200', now)).toBe(true)
    expect(claimExternalFile('paylasim:plan.dwg:1200', now + 800)).toBe(false)
    expect(claimExternalFile('paylasim:plan.dwg:1200', now + EXTERNAL_FILE_DEDUPE_MS - 1)).toBe(false)
    expect(claimExternalFile('other:plan.dxf:40', now + 800)).toBe(true)
    expect(claimExternalFile('paylasim:plan.dwg:1200', now + EXTERNAL_FILE_DEDUPE_MS)).toBe(true)
    expect(claimExternalFile(undefined, now)).toBe(true)
    expect(claimExternalFile(undefined, now)).toBe(true)
  })

  it('builds one file from a base64 payload', () => {
    const payload = {
      id: 'a',
      name: 'plan.dxf',
      mimeType: 'application/dxf',
      base64: globalThis.btoa('0\nEOF\n'),
    }
    const first = fileFromPayload(payload)
    const second = fileFromPayload(payload)
    expect(first).not.toBe(second)
    expect(first.name).toBe('plan.dxf')
    expect(first.size).toBe(second.size)
    expect(first.type).toBe('application/dxf')
  })
})
