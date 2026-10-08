import type { LucideIcon } from 'lucide-react'
import { FolderOpen, Maximize, Menu, Ruler, ZoomIn, ZoomOut } from 'lucide-react'

type ThumbAction = {
  id: string
  label: string
  icon: LucideIcon
  onClick: () => void
  active?: boolean
  primary?: boolean
}

export function ThumbToolbar({
  onQuickMenu,
  quickMenuOpen,
  onOpen,
  onMeasure,
  measureActive,
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  onQuickMenu: () => void
  quickMenuOpen: boolean
  onOpen: () => void
  onMeasure: () => void
  measureActive: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
}) {
  const actions: ThumbAction[] = [
    { id: 'zoom-in', label: 'Yakin', icon: ZoomIn, onClick: onZoomIn },
    { id: 'zoom-out', label: 'Uzak', icon: ZoomOut, onClick: onZoomOut },
    { id: 'fit', label: 'Sığdır', icon: Maximize, onClick: onFit },
    { id: 'open', label: 'Ac', icon: FolderOpen, onClick: onOpen, primary: true },
    { id: 'measure', label: 'Olc', icon: Ruler, onClick: onMeasure, active: measureActive, primary: true },
  ]

  return (
    <div className="thumb-toolbar" aria-label="Tek elle araç çubuğu">
      <div className="thumb-toolbar-cluster">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className={`thumb-btn${action.primary ? ' primary' : ''}${action.active ? ' active' : ''}`}
            aria-label={action.label}
            aria-pressed={action.active}
            onClick={action.onClick}
          >
            <action.icon size={action.primary ? 24 : 20} strokeWidth={2.3} />
            <span>{action.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={`thumb-btn thumb-fab${quickMenuOpen ? ' active' : ''}`}
          aria-label="Hizli menu"
          aria-expanded={quickMenuOpen}
          onClick={onQuickMenu}
        >
          <Menu size={26} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  )
}
