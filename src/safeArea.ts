import { Capacitor } from '@capacitor/core'

const ROOT = () => document.documentElement

export function setSafeAreaInsets(top: number, bottom: number, left = 0, right = 0) {
  const root = ROOT()
  root.style.setProperty('--safe-top', `${top}px`)
  root.style.setProperty('--safe-bottom', `${bottom}px`)
  root.style.setProperty('--safe-left', `${left}px`)
  root.style.setProperty('--safe-right', `${right}px`)
}

export async function initNativeSafeArea() {
  if (!Capacitor.isNativePlatform()) return

  document.documentElement.classList.add('capacitor-native')

  const { StatusBar, Style } = await import('@capacitor/status-bar')
  await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined)
  await StatusBar.setStyle({ style: Style.Light }).catch(() => undefined)
  await StatusBar.setBackgroundColor({ color: '#00000000' }).catch(() => undefined)

  const applyFromEnv = () => {
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;top:env(safe-area-inset-top);bottom:env(safe-area-inset-bottom);'
    document.body.appendChild(probe)
    const top = parseFloat(getComputedStyle(probe).top) || 0
    const bottom = parseFloat(getComputedStyle(probe).bottom) || 0
    probe.remove()
    if (top > 0 || bottom > 0) setSafeAreaInsets(top, bottom)
  }

  applyFromEnv()
  window.addEventListener('resize', applyFromEnv)
  window.addEventListener('orientationchange', () => window.setTimeout(applyFromEnv, 120))
}

declare global {
  interface Window {
    __setSafeAreaInsets?: (top: number, bottom: number, left?: number, right?: number) => void
  }
}

if (typeof window !== 'undefined') {
  window.__setSafeAreaInsets = setSafeAreaInsets
}
