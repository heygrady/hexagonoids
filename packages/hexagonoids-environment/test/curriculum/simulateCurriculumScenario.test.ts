import { describe, expect, it } from 'vitest'

import { doNothingAgent } from '../../src/agents/doNothingAgent.js'
import {
  ALL_PATTERNS,
  type CurriculumScenarioParams,
} from '../../src/curriculum/generateCurriculumScenario.js'
import { simulateCurriculumScenario } from '../../src/curriculum/simulateCurriculumScenario.js'

function makeParams(
  overrides: Partial<CurriculumScenarioParams> = {}
): CurriculumScenarioParams {
  return {
    angle: 0,
    pattern: 'inbound',
    rockSize: 2,
    headingJitter: 0,
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

  it('runs without error for all patterns', () => {
    for (const pattern of ALL_PATTERNS) {
      const metrics = simulateCurriculumScenario(
        doNothingAgent,
        makeParams({ pattern }),
        'test-seed',
        33
      )
      expect(typeof metrics.rocksDestroyed).toBe('number')
    }
  })

  it('runs without error for various angles', () => {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * 2 * Math.PI
      const metrics = simulateCurriculumScenario(
        doNothingAgent,
        makeParams({ angle }),
        'test-seed',
        33
      )
      expect(typeof metrics.rocksDestroyed).toBe('number')
    }
  })
})
