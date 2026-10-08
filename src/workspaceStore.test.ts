import { beforeEach, describe, expect, it } from 'vitest'
import { loadWorkspace, saveWorkspace } from './workspaceStore'

beforeEach(() => {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    },
  })
})

describe('workspace store', () => {
  it('restores markup for the same drawing and ignores another file', () => {
    saveWorkspace('plan.dwg', 120, {
      sketches: [{ id: 's1' }],
      measures: [{ id: 'm1' }],
      notes: [{ id: 'n1' }],
      numbers: [],
      comments: [],
      hiddenLayers: ['TEXT'],
      unitsPerDrawingUnit: 0.001,
      unitLabel: 'mm',
    })
    const saved = loadWorkspace('plan.dwg', 120)
    expect(saved?.sketches).toEqual([{ id: 's1' }])
    expect(saved?.hiddenLayers).toEqual(['TEXT'])
    expect(saved?.unitLabel).toBe('mm')
    expect(loadWorkspace('plan.dwg', 121)).toBeNull()
  })
})