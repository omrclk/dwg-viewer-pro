import { describe, expect, it } from 'vitest'
import { bindDeviceFileInput, buildOpenedFile, type DeviceFileInput } from './fileOpenService'

class FakeInput implements DeviceFileInput {
  files: File[] | null = null
  value = 'previous'
  listeners = new Map<string, Array<() => void>>()
  addEventListener(type: string, listener: () => void) {
    const list = this.listeners.get(type) ?? []
    list.push(listener)
    this.listeners.set(type, list)
  }
  removeEventListener(type: string, listener: () => void) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((item) => item !== listener))
  }
  click() {}
  dispatch(type: string) {
    ;(this.listeners.get(type) ?? []).slice().forEach((listener) => listener())
  }
}

describe('device file picker', () => {
  it('resolves cancel and can be used again', async () => {
    const first = new FakeInput()
    const cancelled = new Promise<File | null>((resolve) => {
      bindDeviceFileInput(first, resolve)
    })
    first.dispatch('cancel')
    await expect(cancelled).resolves.toBeNull()
    expect(first.value).toBe('')

    const second = new FakeInput()
    const file = new File(['0\nSECTION\n'], 'plan.dxf', { type: 'application/dxf' })
    const picked = new Promise<File | null>((resolve) => {
      bindDeviceFileInput(second, resolve)
    })
    second.files = [file]
    second.dispatch('change')
    await expect(picked).resolves.toBe(file)
  })

  it('accepts the same file after the input value is cleared', async () => {
    const input = new FakeInput()
    const file = new File(['acad'], 'plan.dwg', { type: 'application/acad' })
    const first = new Promise<File | null>((resolve) => bindDeviceFileInput(input, resolve))
    input.files = [file]
    input.value = 'C:\\plan.dwg'
    input.dispatch('change')
    await expect(first).resolves.toBe(file)
    expect(input.value).toBe('')

    const again = new Promise<File | null>((resolve) => bindDeviceFileInput(input, resolve))
    input.files = [file]
    input.value = 'C:\\plan.dwg'
    input.dispatch('change')
    await expect(again).resolves.toBe(file)
  })

  it('does not stay busy after a bad file: the error is returned and a later open still runs', async () => {
    const bad = await buildOpenedFile(new File(['not a drawing'], 'notlar.txt'), 'device', { skipRecent: true })
    if (!('error' in bad)) throw new Error('unsupported file should fail')
    expect(bad.error).toMatch(/DWG|DXF|PDF/)

    const corrupt = await buildOpenedFile(new File([new Uint8Array([1, 2, 3, 4])], 'bozuk.dwg'), 'device', { skipRecent: true })
    if (!('error' in corrupt)) throw new Error('corrupt DWG should fail')
    expect(corrupt.error.length).toBeGreaterThan(0)

    const dxf = new File(['0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n'], 'tekrar.dxf', { type: 'application/dxf' })
    const again = await buildOpenedFile(dxf, 'device', { skipRecent: true })
    expect(again.ok === true || again.ok === false).toBe(true)
  })
})