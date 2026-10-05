export type SnapKind = 'endpoint' | 'midpoint' | 'center' | 'intersection'

export type SnapSettings = {
  enabled: boolean
  endpoint: boolean
  midpoint: boolean
  center: boolean
  intersection: boolean
}

export type PerformanceMode = 'auto' | 'high' | 'low'

export type AppTheme = 'dark' | 'light'

export type AppSettings = {
  snap: SnapSettings
  performanceMode: PerformanceMode
  theme: AppTheme
  measureDecimals: number
  textHeight: number
}

const STORAGE_KEY = 'dwg-viewer-settings'

const defaultSettings: AppSettings = {
  snap: {
    enabled: true,
    endpoint: true,
    midpoint: true,
    center: true,
    intersection: true,
  },
  performanceMode: 'auto',
  theme: 'dark',
  measureDecimals: 3,
  textHeight: 2.5,
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      ...defaultSettings,
      ...parsed,
      snap: { ...defaultSettings.snap, ...parsed.snap },
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      textHeight: parsed.textHeight ?? defaultSettings.textHeight,
      measureDecimals: parsed.measureDecimals ?? defaultSettings.measureDecimals,
    }
  } catch {
    return defaultSettings
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function detectLowEndDevice() {
  if (typeof navigator === 'undefined') return false
  const cores = navigator.hardwareConcurrency ?? 4
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  return cores <= 4 || memory <= 4 || Boolean(saveData)
}

export function resolvePerformanceMode(mode: PerformanceMode) {
  if (mode === 'low') return true
  if (mode === 'high') return false
  return detectLowEndDevice()
}

export function entityRenderLimit(lowPerf: boolean) {
  return lowPerf ? 80000 : 200000
}
