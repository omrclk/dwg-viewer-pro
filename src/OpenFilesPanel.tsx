import { useEffect, useState } from 'react'
import { Cloud, HardDrive, Smartphone } from 'lucide-react'
import { cloudProviderStatus, type CloudProvider } from './cloud'
import { formatBytes, sourceLabel, type RecentFileEntry } from './fileTypes'
import { clearRecentFiles, formatRecentTime, listRecentFiles, removeRecentFile } from './recentFiles'

const cloudProviders: Array<{ id: CloudProvider; label: string; color: string }> = [
  { id: 'google-drive', label: 'Google Drive', color: '#4285f4' },
  { id: 'onedrive', label: 'OneDrive', color: '#0078d4' },
  { id: 'dropbox', label: 'Dropbox', color: '#0061ff' },
]

export function OpenFilesPanel({
  onPickDevice,
  onPickCloud,
  onOpenRecent,
  onClose,
  busy,
  statusMessage,
}: {
  onPickDevice: () => void
  onPickCloud: (provider: CloudProvider) => void
  onOpenRecent: (entry: RecentFileEntry) => void
  onClose: () => void
  busy: boolean
  statusMessage?: string
}) {
  const [recent, setRecent] = useState<RecentFileEntry[]>([])
  const configured = cloudProviderStatus()

  const refreshRecent = () => setRecent(listRecentFiles())

  useEffect(() => {
    refreshRecent()
  }, [])

  return (
    <div className="open-files-panel" role="dialog" aria-label="Dosya ac">
      <div className="open-files-header">
        <strong>Dosya Ac</strong>
        <button type="button" className="open-files-close" aria-label="Kapat" onClick={onClose} disabled={busy}>
          x
        </button>
      </div>

      {statusMessage && <p className="open-files-status">{statusMessage}</p>}

      <section className="open-files-section">
        <h3>Cihaz</h3>
        <button type="button" className="open-source-btn device" onClick={onPickDevice} disabled={busy}>
          <Smartphone size={16} />
          <span>
            <strong>Cihazdan ac</strong>
            <small>Depolama, indirilenler veya dosya yoneticisi</small>
          </span>
        </button>
      </section>

      <section className="open-files-section">
        <h3>Bulut</h3>
        {cloudProviders.some((provider) =>
          provider.id === 'google-drive' ? configured.googleDrive : provider.id === 'onedrive' ? configured.oneDrive : configured.dropbox,
        ) ? (
          <div className="open-cloud-grid">
            {cloudProviders.filter((provider) =>
              provider.id === 'google-drive' ? configured.googleDrive : provider.id === 'onedrive' ? configured.oneDrive : configured.dropbox,
            ).map((provider) => (
              <button
                type="button"
                key={provider.id}
                className="open-source-btn cloud"
                style={{ borderColor: `${provider.color}55` }}
                onClick={() => onPickCloud(provider.id)}
                disabled={busy}
              >
                <Cloud size={16} style={{ color: provider.color }} />
                <span>
                  <strong>{provider.label}</strong>
                  <small>Hazir</small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="open-files-note">
            Bulut hesaplari kapali. Anahtarlari .env icine yazinca Google Drive, OneDrive ve Dropbox burada gorunur. Android dosya secicisi Drive ve OneDrive dosyalarini zaten acabilir.
          </p>
        )}
      </section>

      <section className="open-files-section open-files-recent">
        <div className="open-files-recent-head">
          <h3>Son acilanlar</h3>
          {recent.length > 0 && (
            <button
              type="button"
              className="open-files-clear"
              onClick={() => {
                clearRecentFiles()
                refreshRecent()
              }}
              disabled={busy}
            >
              Temizle
            </button>
          )}
        </div>
        <ul className="open-recent-list">
          {recent.length === 0 && <li className="open-recent-empty">Henuz dosya acilmadi.</li>}
          {recent.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className="open-recent-row"
                onClick={() => onOpenRecent(entry)}
                disabled={busy || !entry.cached}
                title={entry.cached ? 'Tekrar ac' : 'Onbellek yok, yeniden secin'}
              >
                <HardDrive size={14} />
                <span className="open-recent-meta">
                  <strong>{entry.name}</strong>
                  <small>
                    {sourceLabel(entry.source)} · {formatBytes(entry.size)} · {formatRecentTime(entry.openedAt)}
                    {!entry.cached && ' · Yeniden sec'}
                  </small>
                </span>
              </button>
              <button
                type="button"
                className="open-recent-delete"
                aria-label="Listeden kaldir"
                onClick={() => {
                  removeRecentFile(entry.id)
                  refreshRecent()
                }}
                disabled={busy}
              >
                x
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
