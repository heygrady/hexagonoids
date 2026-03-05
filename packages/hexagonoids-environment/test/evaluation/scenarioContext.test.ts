import { describe, expect, it } from 'vitest'
import { computePossibleDeaths } from '../../src/evaluation/scenarioContext.js'

describe('computePossibleDeaths', () => {
  it('returns time-based max for 3000 ticks at 33ms', () => {
    // deathCycleTicks = ceil((1000 + 2000) / 33) = ceil(90.9) = 91
    // maxDeaths = 1 + floor((3000 - 1) / 91) = 1 + 32 = 33
    expect(computePossibleDeaths(3000, 33)).toBe(33)
  })

  it('returns 0 for zero ticks', () => {
    expect(computePossibleDeaths(0, 33)).toBe(0)
  })

  it('returns 0 for negative ticks', () => {
    expect(computePossibleDeaths(-10, 33)).toBe(0)
  })

  it('returns 1 for a single tick', () => {
    // First death can happen immediately
    expect(computePossibleDeaths(1, 33)).toBe(1)
  })

  it('handles 1024 ticks at 33ms (default profile)', () => {
    // deathCycleTicks = 91
    // maxDeaths = 1 + floor(1023 / 91) = 1 + 11 = 12
    expect(computePossibleDeaths(1024, 33)).toBe(12)
  })

  it('returns fewer deaths for short scenario (32 ticks)', () => {
    // deathCycleTicks = 91
    // maxDeaths = 1 + floor(31 / 91) = 1 + 0 = 1
    expect(computePossibleDeaths(32, 33)).toBe(1)
  })

  it('returns fewer deaths for early-ending game (400 ticks)', () => {
    // deathCycleTicks = 91
    // maxDeaths = 1 + floor(399 / 91) = 1 + 4 = 5
    expect(computePossibleDeaths(400, 33)).toBe(5)
  })
})
