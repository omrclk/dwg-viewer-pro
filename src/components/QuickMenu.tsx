import type { LucideIcon } from 'lucide-react'

export type QuickMenuItem = {
  id: string
  label: string
  icon: LucideIcon
  onClick: () => void
  active?: boolean
}

export function QuickMenu({
  open,
  items,
  onClose,
}: {
  open: boolean
  items: QuickMenuItem[]
  onClose: () => void
}) {
  if (!open) return null

  return (
    <>
      <button type="button" className="quick-menu-backdrop" aria-label="Menuyu kapat" onClick={onClose} />
      <div className="quick-menu-sheet" role="dialog" aria-label="Hizli menu">
        <div className="quick-menu-handle" />
        <div className="quick-menu-grid">
          {items.map(({ id, label, icon: Icon, onClick, active }) => (
            <button key={id} type="button" className={`quick-menu-item${active ? ' active' : ''}`} onClick={onClick}>
              <Icon size={26} strokeWidth={2.2} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
