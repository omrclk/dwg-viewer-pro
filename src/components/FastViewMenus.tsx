import type { CSSProperties } from 'react'
import { EllipsisVertical, Redo2, Undo2, X } from 'lucide-react'
import {
  ACI_COLORS,
  categoryIndex,
  MAIN_CATEGORIES,
  SUB_MENUS,
  subMenuColumns,
  subMenuRows,
  type MainCategory,
} from '../fastview/menuConfig'
import { FvTopFit, FvTopLayout, FvTopSave, FvTopZoomWindow, FvTextStyle } from '../fastview/toolIcons'

export function FastViewTopBar({
  menuOpen,
  onClose,
  onAction,
  onTextStyle,
}: {
  menuOpen: boolean
  onClose: () => void
  onAction: (action: 'save' | 'undo' | 'redo' | 'layout' | 'zoomWindow' | 'fit' | 'menu') => void
  onTextStyle?: () => void
}) {
  const tools: Array<{
    id: 'save' | 'undo' | 'redo' | 'layout' | 'zoomWindow' | 'fit' | 'menu'
    label: string
    node: React.ReactNode
  }> = [
    { id: 'save', label: 'Kaydet', node: <FvTopSave size={20} /> },
    { id: 'undo', label: 'Geri al', node: <Undo2 size={20} strokeWidth={2} /> },
    { id: 'redo', label: 'Yinele', node: <Redo2 size={20} strokeWidth={2} /> },
    { id: 'layout', label: 'Gorunum', node: <FvTopLayout size={20} /> },
    { id: 'zoomWindow', label: 'Yakinlastir', node: <FvTopZoomWindow size={20} /> },
    { id: 'fit', label: 'Sigdir', node: <FvTopFit size={20} /> },
    { id: 'menu', label: 'Menu', node: <EllipsisVertical size={20} strokeWidth={2.2} /> },
  ]

  return (
    <>
      <div className="fv-top-bar">
        <button type="button" className="fv-top-close" aria-label="Kapat" onClick={onClose}>
          <X size={22} strokeWidth={2.4} />
        </button>
        <div className="fv-top-strip">
          {tools.map(({ id, label, node }) => (
            <button
              key={id}
              type="button"
              className={`fv-top-btn${id === 'menu' && menuOpen ? ' active' : ''}`}
              aria-label={label}
              onClick={() => onAction(id)}
            >
              {node}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="fv-text-style-btn" aria-label="Metin stili" onClick={onTextStyle}>
        <FvTextStyle size={18} />
        <span className="fv-text-style-caret" />
      </button>
    </>
  )
}

export function FastViewOverflowMenu({
  items,
  onSelect,
}: {
  items: Array<{ id: string; label: string; icon: React.ComponentType<{ size?: number }> }>
  onSelect: (id: string) => void
}) {
  return (
    <div className="fv-overflow" role="menu" aria-label="Daha fazla">
      {items.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" className="fv-overflow-row" onClick={() => onSelect(id)}>
          <Icon size={16} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}

export function FastViewBottomStack({
  activeCategory,
  activeActionId,
  onCategorySelect,
  onSubAction,
}: {
  activeCategory: MainCategory | null
  activeActionId?: string | null
  onCategorySelect: (category: MainCategory) => void
  onSubAction: (actionId: string) => void
}) {
  const tabIndex = categoryIndex(activeCategory)
  const showSub = activeCategory && activeCategory !== 'color'
  const subRows = showSub ? subMenuRows(activeCategory) : 0
  const subCols = showSub ? subMenuColumns(activeCategory) : 6

  return (
    <div
      className={`fv-bottom-stack${showSub ? ' has-sub' : ''}`}
      style={
        {
          '--fv-tab-index': Math.max(tabIndex, 0),
          '--fv-tab-count': MAIN_CATEGORIES.length,
          '--fv-sub-rows': subRows,
          '--fv-sub-cols': subCols,
        } as CSSProperties
      }
    >
      {showSub && (
        <div className="fv-sub-panel" role="toolbar">
          <div className="fv-sub-caret" aria-hidden="true" />
          <div className="fv-sub-grid" style={{ gridTemplateColumns: `repeat(${subCols}, minmax(0, 1fr))` }}>
            {SUB_MENUS[activeCategory].map(({ id, label, icon: Icon, vip }) => (
              <button
                key={id}
                type="button"
                className={`fv-sub-item${activeActionId === id ? ' active' : ''}`}
                aria-pressed={activeActionId === id}
                onClick={() => onSubAction(id)}
              >
                <span className="fv-sub-icon">
                  <Icon size={26} />
                  {vip && <i className="fv-vip">V</i>}
                </span>
                <span className="fv-sub-label">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="fv-bottom-nav" aria-label="Ana araç çubuğu">
        {MAIN_CATEGORIES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`fv-nav-item${activeCategory === id ? ' active' : ''}`}
            aria-pressed={activeCategory === id}
            onClick={() => onCategorySelect(id)}
          >
            <span className="fv-nav-icon">
              <Icon size={24} />
            </span>
            <span className="fv-nav-label">{label}</span>
            {activeCategory === id && showSub && <span className="fv-nav-tab-mark" aria-hidden="true" />}
          </button>
        ))}
      </nav>
    </div>
  )
}

export function FastViewColorModal({
  color,
  colorMode,
  onSelectColor,
  onSelectMode,
  onClose,
  onConfirm,
}: {
  color: string
  colorMode: 'byLayer' | 'byBlock' | 'aci'
  onSelectColor: (color: string) => void
  onSelectMode: (mode: 'byLayer' | 'byBlock') => void
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fv-color-backdrop" role="presentation" onClick={onClose}>
      <div className="fv-color-modal" role="dialog" aria-label="renk ayarı" onClick={(event) => event.stopPropagation()}>
        <h2 className="fv-color-title">renk ayarı</h2>
        <div className="fv-color-swatches">
          {ACI_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className={swatch === color && colorMode === 'aci' ? 'active' : ''}
              style={{ backgroundColor: swatch }}
              aria-label={`Renk ${swatch}`}
              onClick={() => onSelectColor(swatch)}
            />
          ))}
        </div>
        <div className="fv-color-modes">
          <button type="button" className={colorMode === 'byLayer' ? 'active' : ''} onClick={() => onSelectMode('byLayer')}>
            ByLayer
          </button>
          <button type="button" className={colorMode === 'byBlock' ? 'active' : ''} onClick={() => onSelectMode('byBlock')}>
            ByBlock
          </button>
        </div>
        <label className="fv-color-field">
          <span>Renk</span>
          <input
            className={colorMode !== 'aci' ? 'active' : ''}
            value={colorMode === 'byLayer' ? 'ByLayer' : colorMode === 'byBlock' ? 'ByBlock' : color}
            readOnly
          />
          <i style={{ backgroundColor: colorMode === 'aci' ? color : '#ff00ff' }} />
        </label>
        <p className="fv-color-hint">Lütfen 1 ile 255 arasında bir değer girin</p>
        <div className="fv-color-actions">
          <button type="button" className="cancel" onClick={onClose}>
            İptal et
          </button>
          <button type="button" className="ok" onClick={onConfirm}>
            Tamam
          </button>
        </div>
      </div>
    </div>
  )
}
