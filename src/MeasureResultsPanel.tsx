import { downloadTextFile, type MeasureRecord, recordsToCsv } from './measureMath'

export function MeasureResultsPanel({
  records,
  unitLabel,
  unitsPerDrawingUnit,
  expanded,
  onToggle,
  onDelete,
  onClear,
  onClose,
  onCalibrate,
}: {
  records: MeasureRecord[]
  unitLabel: string
  unitsPerDrawingUnit: number
  expanded: boolean
  onToggle: () => void
  onDelete: (id: string) => void
  onClear: () => void
  onClose: () => void
  onCalibrate: () => void
}) {
  const exportJson = () => {
    downloadTextFile(
      `olcumler-${Date.now()}.json`,
      JSON.stringify({ unitLabel, unitsPerDrawingUnit, records }, null, 2),
      'application/json',
    )
  }

  const exportCsv = () => {
    downloadTextFile(`olcumler-${Date.now()}.csv`, recordsToCsv(records), 'text/csv')
  }

  return (
    <div className={`measure-results-panel${expanded ? ' is-expanded' : ' is-collapsed'}`} role="dialog" aria-label="Ölçümler">
      <div className="measure-results-header">
        <button type="button" className="measure-results-toggle" aria-expanded={expanded} onClick={onToggle}>
          <strong>Ölçümler</strong>
          <span className="measure-results-meta">
            {records[0]?.displayValue ?? `${records.length} kayıt`}
            {expanded ? '' : ` · 1 birim = ${unitsPerDrawingUnit} ${unitLabel}`}
          </span>
        </button>
        <button type="button" className="measure-results-close" aria-label="Paneli kapat" onClick={onClose}>
          ×
        </button>
      </div>
      {expanded && (
        <div className="measure-results-actions">
          <button type="button" onClick={onCalibrate}>
            Ölçek kalibre
          </button>
          <button type="button" onClick={exportCsv} disabled={!records.length}>
            CSV
          </button>
          <button type="button" onClick={exportJson} disabled={!records.length}>
            JSON
          </button>
          <button type="button" onClick={onClear} disabled={!records.length}>
            Temizle
          </button>
        </div>
      )}
      {expanded && (
      <ul className="measure-results-list">
        {records.length === 0 && <li className="measure-results-empty">Henüz ölçüm yok.</li>}
        {records.map((record) => (
          <li key={record.id} className="measure-result-row">
            <div>
              <span className="measure-result-kind">{record.label}</span>
              <span className="measure-result-value">{record.displayValue}</span>
              <span className="measure-result-time">{record.createdAt}</span>
            </div>
            <button type="button" className="measure-result-delete" aria-label="Ölçümü sil" onClick={() => onDelete(record.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      )}
    </div>
  )
}
