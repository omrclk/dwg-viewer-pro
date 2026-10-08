const STORAGE_KEY = 'dwg-viewer-workspaces'

export type SavedWorkspace = {
  sketches: unknown[]
  measures: unknown[]
  notes: unknown[]
  numbers: unknown[]
  comments: unknown[]
  hiddenLayers: string[]
  unitsPerDrawingUnit?: number
  unitLabel?: string
}

export function workspaceKey(name: string, size: number) {
  return `${name}::${size}`
}

function readAll(): Record<string, SavedWorkspace> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, SavedWorkspace>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function loadWorkspace(name: string, size: number): SavedWorkspace | null {
  const saved = readAll()[workspaceKey(name, size)]
  if (!saved || !Array.isArray(saved.sketches)) return null
  return {
    sketches: saved.sketches,
    measures: Array.isArray(saved.measures) ? saved.measures : [],
    notes: Array.isArray(saved.notes) ? saved.notes : [],
    numbers: Array.isArray(saved.numbers) ? saved.numbers : [],
    comments: Array.isArray(saved.comments) ? saved.comments : [],
    hiddenLayers: Array.isArray(saved.hiddenLayers) ? saved.hiddenLayers : [],
    unitsPerDrawingUnit: typeof saved.unitsPerDrawingUnit === 'number' ? saved.unitsPerDrawingUnit : undefined,
    unitLabel: typeof saved.unitLabel === 'string' ? saved.unitLabel : undefined,
  }
}

export function saveWorkspace(name: string, size: number, workspace: SavedWorkspace) {
  const all = readAll()
  all[workspaceKey(name, size)] = workspace
  const keys = Object.keys(all)
  if (keys.length > 24) delete all[keys[0]]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}