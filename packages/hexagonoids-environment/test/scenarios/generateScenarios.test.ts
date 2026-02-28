import { describe, expect, it } from 'vitest'

import { generateScenarios } from '../../src/scenarios/generateScenarios.js'

describe('generateScenarios', () => {
  it('generates at least 1 scenario from a seeded run', () => {
    const scenarios = generateScenarios({
      count: 5,
      baseSeed: 'gen-test-1',
      maxGames: 50,
    })

    expect(scenarios.length).toBeGreaterThanOrEqual(1)
  })

  it('all scenarios have version === 1', () => {
    const scenarios = generateScenarios({
      count: 5,
      baseSeed: 'gen-test-2',
      maxGames: 50,
    })

    for (const s of scenarios) {
      expect(s.version).toBe(1)
    }
  })

  it('all scenarios have difficulty in [0, 1]', () => {
    const scenarios = generateScenarios({
      count: 5,
      baseSeed: 'gen-test-3',
      maxGames: 50,
    })

    for (const s of scenarios) {
      expect(s.difficulty).toBeGreaterThanOrEqual(0)
      expect(s.difficulty).toBeLessThanOrEqual(1)
    }
  })

  it('all scenarios have ship.alive === true (rewound before death)', () => {
    const scenarios = generateScenarios({
      count: 5,
      baseSeed: 'gen-test-4',
      maxGames: 50,
    })

    for (const s of scenarios) {
      expect(s.ship.alive).toBe(true)
    }
  })

  it('all scenarios have at least 1 rock', () => {
    const scenarios = generateScenarios({
      count: 5,
      baseSeed: 'gen-test-5',
      maxGames: 50,
    })

    for (const s of scenarios) {
      expect(s.rocks.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('scenario IDs are unique', () => {
    const scenarios = generateScenarios({
      count: 10,
      baseSeed: 'gen-test-6',
      maxGames: 100,
    })

    const ids = scenarios.map((s) => s.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})
