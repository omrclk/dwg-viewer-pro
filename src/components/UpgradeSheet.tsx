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
        <h2>Pro kilidini aç</h2>
        <ul>
          <li>Sınırsız ölçüm kaydı</li>
          <li>Filigransız PDF ve görsel dışa aktarma</li>
          <li>Gelişmiş ölçüm, düzenleme ve işaretleme araçları</li>
        </ul>
        <p className="upgrade-price">{priceLabel}</p>
        <p className="upgrade-note">Tek seferlik Google Play ürünü: {BILLING_PRODUCTS.proUnlock}. Web önizlemesinde satın alma kapalı; ödeme yalnızca Play Store kurulumunda tamamlanır.</p>
        {error && <p className="upgrade-error">{error}</p>}
        <div className="upgrade-actions">
          <button type="button" onClick={onPurchase} disabled={busy}>
            {busy ? 'Bekleyin...' : 'Pro satın al'}
          </button>
          <button type="button" onClick={onRestore} disabled={busy}>
            Satın almayı geri yükle
          </button>
          <button type="button" className="upgrade-dismiss" onClick={onClose}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}
