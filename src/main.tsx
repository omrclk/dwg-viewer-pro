import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { initNativeSafeArea } from './safeArea.ts'
import './index.css'
import App from './App.tsx'

if (Capacitor.isNativePlatform()) {
  void initNativeSafeArea()
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister())
  }).catch(() => undefined)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
