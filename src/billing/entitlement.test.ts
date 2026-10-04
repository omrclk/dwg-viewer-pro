import { describe, expect, it } from 'vitest'
import { BILLING_PRODUCTS, FREE_MEASURE_LIMIT } from './products'

describe('billing config', () => {
  it('uses a stable one-time product id and a finite free measure cap', () => {
    expect(BILLING_PRODUCTS.proUnlock).toBe('com.dwgviewer.pro.unlock')
    expect(FREE_MEASURE_LIMIT).toBeGreaterThan(0)
  })
})
