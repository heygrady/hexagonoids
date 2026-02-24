import { describe, expect, it } from 'vitest'
import { DEMO_DEFAULTS } from '../src/configDefaults.js'

describe('configDefaults', () => {
  it('contains positive numeric defaults', () => {
    const values = Object.values(DEMO_DEFAULTS)

    for (const value of values) {
      expect(typeof value).toBe('number')
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
    }
  })

  it('uses multi-seed evaluation by default', () => {
    expect(DEMO_DEFAULTS.evaluationSeedsPerOrganism).toBeGreaterThanOrEqual(2)
  })

  it('is serializable as plain JSON', () => {
    expect(() => JSON.stringify(DEMO_DEFAULTS)).not.toThrow()
  })
})
