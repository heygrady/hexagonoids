import { beforeEach, describe, expect, it } from 'vitest'
import { generateId, resetIdCounter } from '../../src/index.js'

describe('generateId', () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it('returns prefixed IDs with incrementing counter', () => {
    expect(generateId('ship')).toBe('ship-0')
    expect(generateId('ship')).toBe('ship-1')
    expect(generateId('rock')).toBe('rock-2')
  })

  it('resetIdCounter resets the counter to zero', () => {
    generateId('bullet')
    generateId('bullet')
    resetIdCounter()

    expect(generateId('bullet')).toBe('bullet-0')
  })
})
