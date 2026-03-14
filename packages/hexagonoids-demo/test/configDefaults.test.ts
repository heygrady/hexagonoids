import { describe, expect, it } from 'vitest'
import { LAB_ANALYSIS_DEFAULTS } from '../src/features/runtime/configDefaults.js'

describe('configDefaults', () => {
  it('contains positive numeric defaults', () => {
    const values = Object.values(LAB_ANALYSIS_DEFAULTS)

    for (const value of values) {
      expect(typeof value).toBe('number')
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
    }
  })

  it('is serializable as plain JSON', () => {
    expect(() => JSON.stringify(LAB_ANALYSIS_DEFAULTS)).not.toThrow()
  })
})
