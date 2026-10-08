import type { AppSettings } from '../settings'

export function SettingsPanel({
  settings,
  pro,
  onChange,
  onClose,
  onUpgrade,
  onPrivacy,
}: {
  settings: AppSettings
  pro: boolean
  onChange: (next: AppSettings) => void
  onClose: () => void
  onUpgrade: () => void
  onPrivacy: () => void
}) {
  return (
    <div className="settings-panel" role="dialog" aria-label="Olcum ayarlari">
      <div className="tool-panel-header">
        <strong>Hassasiyet</strong>
        <button type="button" aria-label="Ayarlari kapat" onClick={onClose}>
          x
        </button>
      </div>
      <label className="settings-row">
        <span>Ondalik basamak</span>
        <input
          type="range"
          min={0}
          max={4}
          step={1}
          value={settings.measureDecimals}
          onChange={(event) => onChange({ ...settings, measureDecimals: Number(event.target.value) })}
        />
        <em>{settings.measureDecimals}</em>
      </label>
      <label className="settings-row">
        <span>Tema</span>
        <button
          type="button"
          onClick={() => onChange({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' })}
        >
          {settings.theme === 'dark' ? 'Koyu' : 'Acik'}
        </button>
      </label>
      <label className="settings-row">
        <span>Metin yuksekligi</span>
        <input
          type="number"
          min={0.5}
          max={200}
          step={0.5}
          value={settings.textHeight}
          onChange={(event) => onChange({ ...settings, textHeight: Number(event.target.value) || settings.textHeight })}
        />
      </label>
      <label className="settings-row">
        <span>Yakalama (Snap)</span>
        <input
          type="checkbox"
          checked={settings.snap.enabled}
          onChange={(event) => onChange({ ...settings, snap: { ...settings.snap, enabled: event.target.checked } })}
        />
      </label>
      <label className="settings-row">
        <span>Çizgi kalınlıklarını göster</span>
        <input
          type="checkbox"
          checked={settings.showLineweights}
          onChange={(event) => onChange({ ...settings, showLineweights: event.target.checked })}
        />
      </label>
      <div className="settings-links">
        <button type="button" onClick={onUpgrade}>
          {pro ? 'Pro acik' : 'Pro kilidi'}
        </button>
        <button type="button" onClick={onPrivacy}>
          Gizlilik
        </button>
      </div>
    </div>
  )
}
