import type { AppSettings } from '../settings'

export function SettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: AppSettings
  onChange: (next: AppSettings) => void
  onClose: () => void
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
        <span>Yakalama (Snap)</span>
        <input
          type="checkbox"
          checked={settings.snap.enabled}
          onChange={(event) => onChange({ ...settings, snap: { ...settings.snap, enabled: event.target.checked } })}
        />
      </label>
    </div>
  )
}
