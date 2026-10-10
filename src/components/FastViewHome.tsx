import { Cloud, FolderOpen, Home, LayoutGrid, List, MoreVertical, Plus, Search, Star, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cloudProviderStatus, type CloudProvider } from '../cloud'
import { formatBytes, sourceLabel, type RecentFileEntry } from '../fileTypes'
import { fileTitle, formatTurkishDateTime } from '../fileListFormat'
import { FvDimLinear } from '../fastview/toolIcons'
import { ensureRecentThumbnail, loadSampleThumbnail } from '../filePreview'
import { listRecentFiles, loadCachedFile, removeRecentFile, updateRecentFile } from '../recentFiles'
import { APP_VERSION } from '../version'

type HomeTab = 'recent' | 'favorite' | 'drawings'
type HomeNav = 'home' | 'files' | 'cloud'
type SortKey = 'date' | 'name' | 'size'

type Props = {
  recentFiles: RecentFileEntry[]
  fileBusy?: boolean
  statusMessage?: string
  pro?: boolean
  onPickDevice: (origin?: string) => void
  onPickCloud: (provider: CloudProvider) => void
  onOpenRecent: (entry: RecentFileEntry) => void
  onOpenSample: (format: 'dwg' | 'dxf') => void
  onEnterViewer?: () => void
  onRefresh: () => void
  onOpenPrivacy: () => void
  onUpgrade: () => void
}

const cloudProviders: Array<{ id: CloudProvider; label: string }> = [
  { id: 'google-drive', label: 'Google Drive' },
  { id: 'onedrive', label: 'OneDrive' },
  { id: 'dropbox', label: 'Dropbox' },
]

function FileName({ name }: { name: string }) {
  const title = fileTitle(name)
  return (
    <span className="fv-file-name" title={name}>
      {title.text}
      {title.ext ? <span className="fv-file-ext">{title.ext}</span> : null}
    </span>
  )
}

function Thumb({ src, label }: { src?: string | null; label: string }) {
  if (src) return <img className="fv-file-thumb" src={src} alt="" />
  return <span className="fv-file-thumb is-pending" aria-hidden="true">{label.slice(0, 3).toUpperCase()}</span>
}

export function FastViewHome({
  recentFiles,
  fileBusy,
  statusMessage,
  pro,
  onPickDevice,
  onPickCloud,
  onOpenRecent,
  onOpenSample,
  onEnterViewer,
  onRefresh,
  onOpenPrivacy,
  onUpgrade,
}: Props) {
  const [tab, setTab] = useState<HomeTab>('recent')
  const [nav, setNav] = useState<HomeNav>('home')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('date')
  const [grid, setGrid] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [info, setInfo] = useState<RecentFileEntry | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [sampleThumbs, setSampleThumbs] = useState<{ dwg?: string; dxf?: string }>({})
  const configured = cloudProviderStatus()

  useEffect(() => {
    let cancel = false
    const pending = recentFiles.filter((entry) => !thumbs[entry.id] && (entry.format === 'dwg' || entry.format === 'dxf'))
    void (async () => {
      let versionChanged = false
      for (const entry of pending.slice(0, 12)) {
        try {
          const url = await ensureRecentThumbnail(entry)
          if (cancel) return
          if (url) setThumbs((current) => (current[entry.id] ? current : { ...current, [entry.id]: url }))
          if (!entry.versionLabel && listRecentFiles().some((item) => item.id === entry.id && item.versionLabel)) versionChanged = true
        } catch {
          /* one bad cache entry should not block the list */
        }
      }
      if (!cancel && versionChanged) onRefresh()
    })()
    return () => {
      cancel = true
    }
    // thumbs is intentionally read once per recentFiles change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentFiles])

  useEffect(() => {
    if (nav !== 'home' || tab !== 'drawings') return
    let cancel = false
    void (async () => {
      const [dwg, dxf] = await Promise.all([loadSampleThumbnail('dwg'), loadSampleThumbnail('dxf')])
      if (cancel) return
      setSampleThumbs({ dwg: dwg ?? undefined, dxf: dxf ?? undefined })
    })()
    return () => {
      cancel = true
    }
  }, [nav, tab])

  const visibleFiles = useMemo(() => {
    const pool = tab === 'favorite' ? recentFiles.filter((entry) => entry.favorite) : recentFiles
    const q = query.trim().toLocaleLowerCase('tr')
    const filtered = q ? pool.filter((entry) => entry.name.toLocaleLowerCase('tr').includes(q)) : pool
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'tr')
      if (sort === 'size') return b.size - a.size
      return b.openedAt.localeCompare(a.openedAt)
    })
  }, [query, recentFiles, sort, tab])

  const shareEntry = async (entry: RecentFileEntry) => {
    const file = await loadCachedFile(entry.id)
    if (!file) {
      setInfo(entry)
      return
    }
    const named = file.name === entry.name ? file : new File([file], entry.name, { type: file.type })
    const navShare = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
    if (navShare.share && (!navShare.canShare || navShare.canShare({ files: [named] }))) {
      try {
        await navShare.share({ files: [named], title: entry.name })
        return
      } catch {
        /* fall through to download */
      }
    }
    const url = URL.createObjectURL(named)
    const link = document.createElement('a')
    link.href = url
    link.download = entry.name
    link.click()
    URL.revokeObjectURL(url)
  }

  const renameEntry = (entry: RecentFileEntry) => {
    const next = window.prompt('Yeni dosya adı', entry.name)
    const trimmed = next?.trim()
    if (!trimmed || trimmed === entry.name) return
    const dot = entry.name.lastIndexOf('.')
    const ext = dot > 0 ? entry.name.slice(dot) : ''
    const renamed = ext && !trimmed.toLocaleLowerCase('tr').endsWith(ext.toLocaleLowerCase('tr')) ? `${trimmed}${ext}` : trimmed
    updateRecentFile(entry.id, { name: renamed })
    onRefresh()
  }

  const goHome = () => {
    setNav('home')
    setMenuId(null)
  }

  return (
    <div className="fv-home">
      <header className="fv-home-header">
        <div className="fv-home-brand-row">
          <button type="button" className="fv-home-avatar" aria-label="Hesap" onClick={() => setAccountOpen(true)}>
            <UserRound size={18} />
            {pro ? <i className="fv-home-pro">Pro</i> : null}
          </button>
          <div className="fv-home-brand">
            <span className="fv-home-logo">D</span>
            <span>DWG Viewer Pro <small className="fv-home-version">{APP_VERSION}</small></span>
          </div>
          <span />
        </div>
        {nav === 'home' && (
          <div className="fv-home-tabs" role="tablist">
            {(
              [
                ['recent', 'Son'],
                ['favorite', 'Favori'],
                ['drawings', 'Örnekler'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                className={`fv-home-tab${tab === id ? ' active' : ''}`}
                aria-selected={tab === id}
                onClick={() => {
                  setTab(id)
                  setMenuId(null)
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="fv-home-content">
        {statusMessage && <p className="fv-home-status" role="status">{statusMessage}</p>}

        {nav === 'files' && (
          <section className="fv-screen" aria-label="Cihaz">
            <h1>Cihaz</h1>
            <p>Telefon deposu, indirilenler ve klasörler. Dosyayı buradan seçin.</p>
            <button type="button" className="fv-screen-action" onClick={() => onPickDevice('Cihaz')} disabled={fileBusy}>
              <FolderOpen size={18} />
              Cihazdan aç
            </button>
          </section>
        )}

        {nav === 'cloud' && (
          <section className="fv-screen" aria-label="Bulut">
            <h1>Bulut</h1>
            <p>
              Google Drive, OneDrive ve Dropbox hesap anahtarı yoksa kaynaklar kapalıdır. Sistem dosya seçicisi, telefonda yüklüyse Drive ve OneDrive sağlayıcılarını da listeler.
            </p>
            <ul className="fv-cloud-list">
              {cloudProviders.map((provider) => {
                const ready = provider.id === 'google-drive' ? configured.googleDrive : provider.id === 'onedrive' ? configured.oneDrive : configured.dropbox
                return (
                  <li key={provider.id}>
                    <button
                      type="button"
                      className="fv-cloud-row"
                      disabled={!ready || fileBusy}
                      onClick={() => onPickCloud(provider.id)}
                    >
                      <Cloud size={18} />
                      <span>
                        <strong>{provider.label}</strong>
                        <small>{ready ? 'Bağlı' : 'Yakında'}</small>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <button type="button" className="fv-screen-action" onClick={() => onPickDevice('Sistem seçici')} disabled={fileBusy}>
              Sistem seçicisiyle aç
            </button>
          </section>
        )}

        {nav === 'home' && tab === 'recent' && (
          <div className="fv-home-tip">
            <span className="fv-home-tip-icon">
              <FvDimLinear size={28} />
            </span>
            <span>DWG ve DXF açın, katmanları kapatın, mesafe ve alan ölçün.</span>
          </div>
        )}

        {nav === 'home' && tab !== 'drawings' && (
          <>
            <div className="fv-file-tools">
              <label className="fv-file-search">
                <Search size={14} />
                <input aria-label="Dosya ara" placeholder="Dosya ara" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <select aria-label="Sırala" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
                <option value="date">Tarih</option>
                <option value="name">Ad</option>
                <option value="size">Boyut</option>
              </select>
              <button type="button" aria-label="Liste" aria-pressed={!grid} className={!grid ? 'is-on' : ''} onClick={() => setGrid(false)}>
                <List size={16} />
              </button>
              <button type="button" aria-label="Izgara" aria-pressed={grid} className={grid ? 'is-on' : ''} onClick={() => setGrid(true)}>
                <LayoutGrid size={16} />
              </button>
            </div>
            {visibleFiles.length === 0 && (
              <p className="fv-home-empty">
                {query
                  ? 'Eşleşen dosya yok.'
                  : tab === 'recent'
                    ? 'Henüz dosya açılmadı. + ile cihazdan seçin.'
                    : 'Favori dosya yok. Yıldıza dokunun.'}
              </p>
            )}
            <div className={`fv-file-list${grid ? ' is-grid' : ''}`}>
              {visibleFiles.map((entry) => (
                <article key={entry.id} className="fv-file-row">
                  <button type="button" className="fv-file-open" onClick={() => onOpenRecent(entry)}>
                    <Thumb src={thumbs[entry.id]} label={entry.format} />
                    <span className="fv-file-copy">
                      <FileName name={entry.name} />
                      <span className="fv-file-meta">
                        <em className="fv-file-badge">{entry.format.toUpperCase()}</em>
                        {entry.versionLabel && <span className="fv-file-version">{entry.versionLabel}</span>}
                        <span>{formatBytes(entry.size)}</span>
                        <span>{formatTurkishDateTime(entry.openedAt)}</span>
                        <span>{entry.origin || sourceLabel(entry.source)}</span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`fv-file-star${entry.favorite ? ' is-on' : ''}`}
                    aria-label={entry.favorite ? 'Favoriden çıkar' : 'Favoriye ekle'}
                    onClick={() => {
                      updateRecentFile(entry.id, { favorite: !entry.favorite })
                      onRefresh()
                    }}
                  >
                    <Star size={16} fill={entry.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    className="fv-file-more"
                    aria-label={`${entry.name} menüsü`}
                    aria-expanded={menuId === entry.id}
                    onClick={() => setMenuId((current) => (current === entry.id ? null : entry.id))}
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuId === entry.id && (
                    <div className="fv-file-menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => { updateRecentFile(entry.id, { favorite: !entry.favorite }); setMenuId(null); onRefresh() }}>
                        {entry.favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                      </button>
                      <button type="button" role="menuitem" onClick={() => { setMenuId(null); renameEntry(entry) }}>Yeniden adlandır</button>
                      <button type="button" role="menuitem" onClick={() => { setMenuId(null); void shareEntry(entry) }}>Paylaş</button>
                      <button type="button" role="menuitem" onClick={() => { removeRecentFile(entry.id); setMenuId(null); onRefresh() }}>Listeden kaldır</button>
                      <button type="button" role="menuitem" onClick={() => { setMenuId(null); setInfo(entry) }}>Dosya bilgisi</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        )}

        {nav === 'home' && tab === 'drawings' && (
          <div className="fv-file-list">
            <article className="fv-file-row">
              <button type="button" className="fv-file-open" onClick={() => onOpenSample('dwg')}>
                <Thumb src={sampleThumbs.dwg} label="DWG" />
                <span className="fv-file-copy">
                  <FileName name="örnek-plan.dwg" />
                  <span className="fv-file-meta">
                    <em className="fv-file-badge">DWG</em>
                    <span className="fv-file-version">AutoCAD 2018</span>
                    <span>Örnekler</span>
                  </span>
                </span>
              </button>
            </article>
            <article className="fv-file-row">
              <button type="button" className="fv-file-open" onClick={() => onOpenSample('dxf')}>
                <Thumb src={sampleThumbs.dxf} label="DXF" />
                <span className="fv-file-copy">
                  <FileName name="örnek-plan.dxf" />
                  <span className="fv-file-meta">
                    <em className="fv-file-badge">DXF</em>
                    <span className="fv-file-version">DXF</span>
                    <span>Örnekler</span>
                  </span>
                </span>
              </button>
            </article>
            <article className="fv-file-row">
              <button type="button" className="fv-file-open" onClick={onEnterViewer}>
                <Thumb label="CAD" />
                <span className="fv-file-copy">
                  <FileName name="Boş görüntüleyici" />
                  <span className="fv-file-meta">
                    <span>Araçları dosya açmadan deneyin</span>
                  </span>
                </span>
              </button>
            </article>
          </div>
        )}
      </div>

      {nav === 'home' && (
        <button type="button" className="fv-home-fab" aria-label="Dosya ekle" onClick={() => onPickDevice('Cihaz')}>
          <Plus size={28} strokeWidth={2.2} />
        </button>
      )}

      <nav className="fv-home-bottom" aria-label="Ana menü">
        <button type="button" className={`fv-home-bottom-btn${nav === 'home' ? ' active' : ''}`} aria-current={nav === 'home' ? 'page' : undefined} onClick={goHome}>
          <Home size={22} strokeWidth={2} />
          <span>Ev</span>
        </button>
        <button
          type="button"
          className={`fv-home-bottom-btn${nav === 'files' ? ' active' : ''}`}
          aria-current={nav === 'files' ? 'page' : undefined}
          onClick={() => {
            setNav('files')
            setMenuId(null)
          }}
        >
          <FolderOpen size={22} strokeWidth={2} />
          <span>Dosya</span>
        </button>
        <button
          type="button"
          className={`fv-home-bottom-btn${nav === 'cloud' ? ' active' : ''}`}
          aria-current={nav === 'cloud' ? 'page' : undefined}
          onClick={() => {
            setNav('cloud')
            setMenuId(null)
          }}
        >
          <Cloud size={22} strokeWidth={2} />
          <span>Bulut</span>
        </button>
      </nav>

      {accountOpen && (
        <div className="upgrade-sheet" role="dialog" aria-label="Hesap">
          <div className="upgrade-card">
            <h2>Hesap</h2>
            <p className="upgrade-note">DWG Viewer Pro {APP_VERSION}. Plan: {pro ? 'Pro açık' : 'Ücretsiz'}.</p>
            <div className="upgrade-actions">
              {!pro && <button type="button" onClick={() => { setAccountOpen(false); onUpgrade() }}>Pro’yu aç</button>}
              <button type="button" onClick={() => { setAccountOpen(false); onOpenPrivacy() }}>Gizlilik</button>
              <button type="button" className="upgrade-dismiss" onClick={() => setAccountOpen(false)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {info && (
        <div className="upgrade-sheet" role="dialog" aria-label="Dosya bilgisi">
          <div className="upgrade-card">
            <h2>Dosya bilgisi</h2>
            <p className="upgrade-note">
              {info.name}
              <br />
              {info.format.toUpperCase()}
              {info.versionLabel ? ` · ${info.versionLabel}` : ''}
              <br />
              {formatBytes(info.size)} · {formatTurkishDateTime(info.openedAt)}
              <br />
              {info.origin || sourceLabel(info.source)}
              {info.cached ? '' : ' · önbellekte yok'}
            </p>
            <div className="upgrade-actions">
              <button type="button" onClick={() => setInfo(null)}>Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
