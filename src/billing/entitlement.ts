import { Capacitor } from '@capacitor/core'
import { BILLING_PRODUCTS } from './products'

const STORAGE_KEY = 'dwg-viewer-pro-entitlement'

export type Entitlement = {
  pro: boolean
  productId?: string
  purchaseToken?: string
  source: 'play' | 'none'
}

const emptyEntitlement: Entitlement = { pro: false, source: 'none' }

export function loadEntitlement(): Entitlement {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyEntitlement
    const parsed = JSON.parse(raw) as Entitlement
    if (parsed?.source === 'play' && parsed.pro && parsed.purchaseToken && parsed.productId === BILLING_PRODUCTS.proUnlock) {
      return parsed
    }
  } catch {
    return emptyEntitlement
  }
  return emptyEntitlement
}

function saveEntitlement(entitlement: Entitlement) {
  if (!entitlement.pro) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entitlement))
}

export function playPurchaseIsOwned(purchase: { productIdentifier?: string; purchaseState?: string; purchaseToken?: string }) {
  if (purchase.productIdentifier !== BILLING_PRODUCTS.proUnlock) return false
  if (!purchase.purchaseToken) return false
  if (purchase.purchaseState && purchase.purchaseState !== '1') return false
  return true
}

export function entitlementFromOwnedPurchase(purchase?: { purchaseToken?: string }): Entitlement {
  if (!purchase?.purchaseToken) return emptyEntitlement
  return {
    pro: true,
    productId: BILLING_PRODUCTS.proUnlock,
    purchaseToken: purchase.purchaseToken,
    source: 'play',
  }
}

export async function refreshEntitlement(): Promise<Entitlement> {
  if (!Capacitor.isNativePlatform()) return emptyEntitlement
  try {
    const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases')
    const support = await NativePurchases.isBillingSupported()
    if (!support.isBillingSupported) return loadEntitlement()
    const result = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP })
    const entitlement = entitlementFromOwnedPurchase(result.purchases.find(playPurchaseIsOwned))
    saveEntitlement(entitlement)
    return entitlement
  } catch {
    return loadEntitlement()
  }
}

/**
 * Ask Play for the current account's purchases before trusting the on-device cache.
 * Offline or unsupported billing keeps the last Play cache so a purchased install
 * still opens without a network. Web builds never honor localStorage.
 */
export async function verifyEntitlementOnStartup(): Promise<Entitlement> {
  if (!Capacitor.isNativePlatform()) {
    saveEntitlement(emptyEntitlement)
    return emptyEntitlement
  }
  try {
    const { NativePurchases } = await import('@capgo/native-purchases')
    const support = await NativePurchases.isBillingSupported()
    if (!support.isBillingSupported) return loadEntitlement()
    await NativePurchases.restorePurchases()
    return refreshEntitlement()
  } catch {
    return loadEntitlement()
  }
}

export async function purchasePro(): Promise<Entitlement> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Satın alma yalnızca Google Play üzerinden yüklenen Android uygulamasında çalışır.')
  }
  const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases')
  const support = await NativePurchases.isBillingSupported()
  if (!support.isBillingSupported) {
    throw new Error('Bu cihazda Google Play Billing kullanılamıyor.')
  }
  const transaction = await NativePurchases.purchaseProduct({
    productIdentifier: BILLING_PRODUCTS.proUnlock,
    productType: PURCHASE_TYPE.INAPP,
    isConsumable: false,
    autoAcknowledgePurchases: true,
  })
  if (!playPurchaseIsOwned(transaction) && transaction.purchaseState && transaction.purchaseState !== '1') {
    throw new Error('Ödeme tamamlanmadı.')
  }
  const entitlement: Entitlement = {
    pro: true,
    productId: BILLING_PRODUCTS.proUnlock,
    purchaseToken: transaction.purchaseToken,
    source: 'play',
  }
  if (!entitlement.purchaseToken) {
    return refreshEntitlement()
  }
  saveEntitlement(entitlement)
  return entitlement
}

export async function restorePro(): Promise<Entitlement> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Geri yükleme yalnızca Android uygulamasında kullanılır.')
  }
  const { NativePurchases } = await import('@capgo/native-purchases')
  await NativePurchases.restorePurchases()
  const entitlement = await refreshEntitlement()
  if (!entitlement.pro) throw new Error('Bu hesapta Pro satın alması bulunamadı.')
  return entitlement
}

export async function loadProProduct() {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases')
    const result = await NativePurchases.getProduct({
      productIdentifier: BILLING_PRODUCTS.proUnlock,
      productType: PURCHASE_TYPE.INAPP,
    })
    return result.product
  } catch {
    return null
  }
}
