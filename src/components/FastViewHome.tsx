import { FolderOpen, Home, MoreVertical, Plus, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { RecentFileEntry } from '../fileTypes'
import { formatBytes, sourceLabel } from '../fileTypes'
import { FvDimLinear } from '../fastview/toolIcons'

type HomeTab = 'recent' | 'favorite' | 'drawings'
type HomeNav = 'home' | 'files' | 'cloud'

type Props = {
  recentFiles: RecentFileEntry[]
  onOpenFile: () => void
  onOpenRecent: (entry: RecentFileEntry) => void
  onToggleFavorite: (entry: RecentFileEntry) => void
  onOpenSample: (format: 'dwg' | 'dxf') => void
  onEnterViewer?: () => void
}

function formatOpenedAt(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

function DemoThumb() {
  return (
    <svg viewBox="0 0 72 52" aria-hidden="true">
      <rect width="72" height="52" fill="#0a0a0a" />
      <rect x="8" y="8" width="30" height="22" fill="none" stroke="#14e5de" strokeWidth="1.2" />
      <rect x="42" y="10" width="22" height="16" fill="none" stroke="#b5a14d" strokeWidth="1" />
      <path d="M8 38h56" stroke="#2cdb70" strokeWidth="1" />
      <path d="M12 42h20M40 42h18" stroke="#fff" strokeWidth="0.8" opacity="0.5" />
    </svg>
  )
}

export function FastViewHome({ recentFiles, onOpenFile, onOpenRecent, onToggleFavorite, onOpenSample, onEnterViewer }: Props) {
  const [tab, setTab] = useState<HomeTab>('recent')
  const [nav, setNav] = useState<HomeNav>('home')

  const visibleFiles = useMemo(() => {
    if (tab === 'favorite') return recentFiles.filter((entry) => entry.favorite)
    if (tab === 'drawings') return []
    return recentFiles
  }, [recentFiles, tab])

  return (
    <div className="fv-home">
      <header className="fv-home-header">
        <div className="fv-home-brand-row">
          <div className="fv-home-avatar" />
          <div className="fv-home-brand">
            <span className="fv-home-logo">D</span>
            <span>DWG Viewer Pro</span>
          </div>
          <span />
        </div>
        <div className="fv-home-tabs" role="tablist">
          {(
            [
              ['recent', 'Son'],
              ['favorite', 'Favori'],
              ['drawings', 'Ornekler'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              className={`fv-home-tab${tab === id ? ' active' : ''}`}
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="fv-home-content">
        <div className="fv-home-tip">
          <span className="fv-home-tip-icon">
            <FvDimLinear size={34} />
          </span>
          <span>DWG ve DXF acin, katmanlari kapatin, mesafe ve alan olcun.</span>
        </div>

        {tab === 'drawings' && (
          <>
            <button type="button" className="fv-home-file" onClick={() => onOpenSample('dwg')}>
              <div className="fv-home-thumb"><DemoThumb /></div>
              <div>
                <div className="fv-home-file-name">Ornek plan.dwg</div>
                <div className="fv-home-file-meta">Katman, blok, tarama, yazi ve olcu</div>
              </div>
            </button>
            <button type="button" className="fv-home-file" onClick={() => onOpenSample('dxf')}>
              <div className="fv-home-thumb"><DemoThumb /></div>
              <div>
                <div className="fv-home-file-name">Ornek plan.dxf</div>
                <div className="fv-home-file-meta">Ayni planin DXF kopyasi</div>
              </div>
            </button>
            <button type="button" className="fv-home-file" onClick={onEnterViewer}>
              <div className="fv-home-thumb"><DemoThumb /></div>
              <div>
                <div className="fv-home-file-name">Bos goruntuleyici</div>
                <div className="fv-home-file-meta">Araclari dosya acmadan deneyin</div>
              </div>
            </button>
          </>
        )}

        {tab !== 'drawings' && visibleFiles.length === 0 && (
          <p className="fv-home-empty">
            {tab === 'recent' ? 'Henuz dosya acilmadi. + ile cihazdan secin.' : 'Favori dosya yok. Listeden yildiza dokunun.'}
          </p>
        )}

        {tab !== 'drawings' && visibleFiles.map((entry) => (
          <div key={entry.id} className="fv-home-file">
            <button type="button" className="fv-home-file-main" onClick={() => onOpenRecent(entry)}>
              <div className="fv-home-thumb">
                <DemoThumb />
              </div>
              <div>
                <div className="fv-home-file-name">{entry.name}</div>
                <div className="fv-home-file-meta">
                  {formatOpenedAt(entry.openedAt)} · {formatBytes(entry.size)}
                  <br />
                  {sourceLabel(entry.source)}
                  {!entry.cached ? ' · onbellekte yok' : ''}
                </div>
              </div>
            </button>
            <button
              type="button"
              className={`fv-home-file-menu${entry.favorite ? ' is-fav' : ''}`}
              aria-label={entry.favorite ? 'Favoriden cikar' : 'Favoriye ekle'}
              onClick={() => onToggleFavorite(entry)}
            >
              {entry.favorite ? <Star size={18} fill="currentColor" /> : <MoreVertical size={18} />}
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="fv-home-fab" aria-label="Dosya ekle" onClick={onOpenFile}>
        <Plus size={28} strokeWidth={2.2} />
      </button>

      <nav className="fv-home-bottom" aria-label="Ana menu">
        <button
          type="button"
          className={`fv-home-bottom-btn${nav === 'home' ? ' active' : ''}`}
          onClick={() => {
            setNav('home')
            setTab('recent')
          }}
        >
          <Home size={22} strokeWidth={2} />
          <span>Ev</span>
        </button>
        <button
          type="button"
          className={`fv-home-bottom-btn${nav === 'files' ? ' active' : ''}`}
          onClick={() => {
            setNav('files')
            onOpenFile()
          }}
        >
          <FolderOpen size={22} strokeWidth={2} />
          <span>Dosya</span>
        </button>
        <button
          type="button"
          className={`fv-home-bottom-btn${nav === 'cloud' ? ' active' : ''}`}
          onClick={() => {
            setNav('cloud')
            onOpenFile()
          }}
        >
          <span className="fv-home-logo" style={{ width: 22, height: 22, fontSize: 11, borderRadius: 4 }}>
            D
          </span>
          <span>Bulut</span>
        </button>
      </nav>
    </div>
  )
}
