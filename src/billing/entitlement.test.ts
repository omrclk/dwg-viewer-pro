import { describe, expect, it } from 'vitest'
import { entitlementFromOwnedPurchase, playPurchaseIsOwned } from './entitlement'
import { BILLING_PRODUCTS, FREE_MEASURE_LIMIT } from './products'

describe('billing config', () => {
  it('uses a stable one-time product id and a finite free measure cap', () => {
    expect(BILLING_PRODUCTS.proUnlock).toBe('com.dwgviewer.pro.unlock')
    expect(FREE_MEASURE_LIMIT).toBeGreaterThan(0)
  })

  it('accepts only an owned Play purchase of the Pro product', () => {
    expect(playPurchaseIsOwned({ productIdentifier: BILLING_PRODUCTS.proUnlock, purchaseToken: 'tok', purchaseState: '1' })).toBe(true)
    expect(playPurchaseIsOwned({ productIdentifier: 'other', purchaseToken: 'tok', purchaseState: '1' })).toBe(false)
    expect(playPurchaseIsOwned({ productIdentifier: BILLING_PRODUCTS.proUnlock, purchaseState: '1' })).toBe(false)
    expect(playPurchaseIsOwned({ productIdentifier: BILLING_PRODUCTS.proUnlock, purchaseToken: 'tok', purchaseState: '0' })).toBe(false)
    expect(entitlementFromOwnedPurchase(undefined).pro).toBe(false)
    const owned = entitlementFromOwnedPurchase({ purchaseToken: 'tok' })
    expect(owned).toMatchObject({ pro: true, productId: BILLING_PRODUCTS.proUnlock, purchaseToken: 'tok', source: 'play' })
  })
})
