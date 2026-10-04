import { BILLING_PRODUCTS } from '../billing/products'

export function UpgradeSheet({
  busy,
  priceLabel,
  error,
  onClose,
  onPurchase,
  onRestore,
}: {
  busy: boolean
  priceLabel: string
  error: string
  onClose: () => void
  onPurchase: () => void
  onRestore: () => void
}) {
  return (
    <div className="upgrade-sheet" role="dialog" aria-label="Pro kilidi">
      <div className="upgrade-card">
        <p className="upgrade-kicker">DWG Viewer Pro</p>
        <h2>Pro kilidini ac</h2>
        <ul>
          <li>Sinirsiz olcum kaydi</li>
          <li>Filigransiz PDF ve gorsel disa aktarma</li>
          <li>Gelismis olcum, duzenleme ve isaretleme araclari</li>
        </ul>
        <p className="upgrade-price">{priceLabel}</p>
        <p className="upgrade-note">Tek seferlik Google Play urunu: {BILLING_PRODUCTS.proUnlock}. Web onizlemesinde satin alma kapali; odeme yalnizca Play Store kurulumunda tamamlanir.</p>
        {error && <p className="upgrade-error">{error}</p>}
        <div className="upgrade-actions">
          <button type="button" onClick={onPurchase} disabled={busy}>
            {busy ? 'Bekleyin...' : 'Pro satin al'}
          </button>
          <button type="button" onClick={onRestore} disabled={busy}>
            Satin almayi geri yukle
          </button>
          <button type="button" className="upgrade-dismiss" onClick={onClose}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}
