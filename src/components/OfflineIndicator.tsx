import { CloudOff, Wifi } from 'lucide-react'

export function OfflineIndicator({ online }: { online: boolean }) {
  return (
    <div className={`offline-indicator${online ? ' online' : ''}`} role="status" aria-live="polite">
      {online ? <Wifi size={12} /> : <CloudOff size={12} />}
      <span>{online ? 'Cevrimici' : 'Offline'}</span>
    </div>
  )
}
