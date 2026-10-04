import type { SnapKind, SnapSettings } from '../settings'
import { snapKindLabel } from '../snapEngine'

const snapOptions: SnapKind[] = ['endpoint', 'midpoint', 'center', 'intersection']

export function SnapPanel({
  settings,
  activeKind,
  onChange,
}: {
  settings: SnapSettings
  activeKind: SnapKind | null
  onChange: (next: SnapSettings) => void
}) {
  return (
    <div className="snap-panel" aria-label="Snap secenekleri">
      <label className="snap-master">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) => onChange({ ...settings, enabled: event.target.checked })}
        />
        <span>Yakalama (Snap)</span>
      </label>
      <div className="snap-options">
        {snapOptions.map((kind) => (
          <button
            key={kind}
            type="button"
            className={`snap-chip${settings[kind] ? ' on' : ''}${activeKind === kind ? ' active' : ''}`}
            disabled={!settings.enabled}
            onClick={() => onChange({ ...settings, [kind]: !settings[kind] })}
          >
            {snapKindLabel(kind)}
          </button>
        ))}
      </div>
    </div>
  )
}
