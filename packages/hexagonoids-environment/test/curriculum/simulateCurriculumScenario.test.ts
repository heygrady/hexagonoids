import { describe, expect, it } from 'vitest'

import { doNothingAgent } from '../../src/agents/doNothingAgent.js'
import type { CurriculumScenarioParams } from '../../src/curriculum/generateCurriculumScenario.js'
import { simulateCurriculumScenario } from '../../src/curriculum/simulateCurriculumScenario.js'

function makeParams(
  overrides: Partial<CurriculumScenarioParams> = {}
): CurriculumScenarioParams {
  return {
    coneIndex: 0,
    variant: 'direct-towards',
    rockSize: 2,
    lateralOffset: 0,
    ...overrides,
  }
}

describe('simulateCurriculumScenario', () => {
  it('doNothingAgent destroys no rocks', () => {
    const metrics = simulateCurriculumScenario(
      doNothingAgent,
      makeParams(),
      'test-seed',
      33
    )
    expect(metrics.rocksDestroyed).toBe(0)
  })

  it('returns consistent results with same seed (deterministic)', () => {
    const a = simulateCurriculumScenario(
      doNothingAgent,
      makeParams(),
      'determinism-seed',
      33
    )
    const b = simulateCurriculumScenario(
      doNothingAgent,
      makeParams(),
      'determinism-seed',
      33
    )
    expect(a.rocksDestroyed).toBe(b.rocksDestroyed)
    expect(a.accuracy).toBe(b.accuracy)
    expect(a.deaths).toBe(b.deaths)
  })

  it('returns full RawMetrics with expected fields', () => {
    const metrics = simulateCurriculumScenario(
      doNothingAgent,
      makeParams(),
      'test-seed',
      33
    )
    expect(typeof metrics.rocksDestroyed).toBe('number')
    expect(typeof metrics.accuracy).toBe('number')
    expect(typeof metrics.deaths).toBe('number')
    expect(typeof metrics.aliveFrames).toBe('number')
    expect(typeof metrics.shotsFired).toBe('number')
    expect(typeof metrics.uniqueRocksSeen).toBe('number')
    expect(typeof metrics.elapsedTicks).toBe('number')
    expect(metrics.elapsedTicks).toBeGreaterThan(0)
  })

  it('runs without error for all variants', () => {
    const variants = [
      'direct-towards',
      'direct-away',
      'lateral-left',
      'lateral-right',
    ] as const
    for (const variant of variants) {
      const metrics = simulateCurriculumScenario(
        doNothingAgent,
        makeParams({ variant }),
        'test-seed',
        33
      )
      expect(typeof metrics.rocksDestroyed).toBe('number')
    }
  })

  it('runs without error for all cone indices', () => {
    for (let i = 0; i < 8; i++) {
      const metrics = simulateCurriculumScenario(
        doNothingAgent,
        makeParams({ coneIndex: i as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 }),
        'test-seed',
        33
      )
      expect(typeof metrics.rocksDestroyed).toBe('number')
    }
  })
})
