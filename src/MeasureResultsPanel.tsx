import { downloadTextFile, type MeasureRecord, recordsToCsv } from './measureMath'

export function MeasureResultsPanel({
  records,
  unitLabel,
  unitsPerDrawingUnit,
  onDelete,
  onClear,
  onClose,
  onCalibrate,
}: {
  records: MeasureRecord[]
  unitLabel: string
  unitsPerDrawingUnit: number
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
    <div className="measure-results-panel" role="dialog" aria-label="Olcum sonuclari">
      <div className="measure-results-header">
        <strong>Olcumler</strong>
        <span className="measure-results-meta">
          {records.length} kayit · 1 birim = {unitsPerDrawingUnit.toFixed(6)} {unitLabel}
        </span>
        <button type="button" className="measure-results-close" aria-label="Paneli kapat" onClick={onClose}>
          x
        </button>
      </div>
      <div className="measure-results-actions">
        <button type="button" onClick={onCalibrate}>
          Olcek kalibre
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
      <ul className="measure-results-list">
        {records.length === 0 && <li className="measure-results-empty">Henuz olcum yok.</li>}
        {records.map((record) => (
          <li key={record.id} className="measure-result-row">
            <div>
              <span className="measure-result-kind">{record.label}</span>
              <span className="measure-result-value">{record.displayValue}</span>
              <span className="measure-result-time">{record.createdAt}</span>
            </div>
            <button type="button" className="measure-result-delete" aria-label="Olcumu sil" onClick={() => onDelete(record.id)}>
              x
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
