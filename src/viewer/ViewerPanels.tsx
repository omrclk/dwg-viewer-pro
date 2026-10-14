export type CommentRecord = {
  id: string
  text: string
  color: string
  createdAt: string
}

const MARKUP_COLORS = ['#18f4ea', '#ffb020', '#ef4444', '#22c55e', '#a855f7', '#f8fafc']

export function LayerPanel({
  layers,
  hiddenLayers,
  entityCounts,
  layerColors,
  onToggle,
  onShowAll,
  onHideAll,
  onClose,
}: {
  layers: string[]
  hiddenLayers: Set<string>
  entityCounts: Map<string, number>
  layerColors: Map<string, string>
  onToggle: (layer: string) => void
  onShowAll: () => void
  onHideAll: () => void
  onClose: () => void
}) {
  const visibleCount = layers.filter((layer) => !hiddenLayers.has(layer)).length

  return (
    <div className="layers-panel" role="dialog" aria-label="Katman listesi">
      <div className="layers-panel-header">
        <strong>Katmanlar</strong>
        <span className="layers-panel-meta">
          {visibleCount}/{layers.length} açık
        </span>
        <button type="button" className="layers-panel-close" aria-label="Katman panelini kapat" onClick={onClose}>
          x
        </button>
      </div>
      <div className="layers-panel-actions">
        <button type="button" onClick={onShowAll}>
          Tümünü aç
        </button>
        <button type="button" onClick={onHideAll}>
          Tümünü kapat
        </button>
      </div>
      <ul className="layers-list">
        {layers.map((layer) => {
          const visible = !hiddenLayers.has(layer)
          const count = entityCounts.get(layer)

          return (
            <li key={layer}>
              <label className="layer-row">
                <input type="checkbox" checked={visible} onChange={() => onToggle(layer)} />
                <span className="layer-swatch" style={{ background: layerColors.get(layer) || '#9aa' }} aria-hidden="true" />
                <span className="layer-name">{layer}</span>
                {count !== undefined && <span className="layer-count">{count}</span>}
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function CommentsPanel({
  comments,
  color,
  onAdd,
  onDelete,
  onClose,
}: {
  comments: CommentRecord[]
  color: string
  onAdd: () => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  return (
    <div className="comments-panel" role="dialog" aria-label="Yorumlar">
      <div className="tool-panel-header">
        <strong>Notlar</strong>
        <span>{comments.length}</span>
        <button type="button" aria-label="Notları kapat" onClick={onClose}>
          x
        </button>
      </div>
      <button type="button" className="tool-panel-primary" onClick={onAdd}>
        Not ekle
      </button>
      <ul className="comments-list">
        {comments.length === 0 && <li className="tool-panel-empty">Henüz yorum yok.</li>}
        {comments.map((comment) => (
          <li key={comment.id} className="comment-row" style={{ borderLeftColor: comment.color }}>
            <div>
              <strong>{comment.text}</strong>
              <span>{comment.createdAt}</span>
            </div>
            <button type="button" aria-label="Notu sil" onClick={() => onDelete(comment.id)}>
              x
            </button>
          </li>
        ))}
      </ul>
      <span className="tool-panel-current" style={{ color }}>
        Seçili renk
      </span>
    </div>
  )
}

export function ColorPalettePanel({
  color,
  onSelect,
  onClose,
}: {
  color: string
  onSelect: (color: string) => void
  onClose: () => void
}) {
  return (
    <div className="color-panel" role="dialog" aria-label="Renk paleti">
      <div className="tool-panel-header">
        <strong>Renk paleti</strong>
        <span style={{ color }}>{color}</span>
        <button type="button" aria-label="Renk paletini kapat" onClick={onClose}>
          x
        </button>
      </div>
      <div className="color-grid">
        {MARKUP_COLORS.map((swatch) => (
          <button
            type="button"
            className={swatch === color ? 'color-swatch active' : 'color-swatch'}
            key={swatch}
            aria-label={`Renk ${swatch}`}
            style={{ backgroundColor: swatch }}
            onClick={() => onSelect(swatch)}
          />
        ))}
      </div>
    </div>
  )
}
