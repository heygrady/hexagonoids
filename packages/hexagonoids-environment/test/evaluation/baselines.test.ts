import { beforeAll, describe, expect, it } from 'vitest'
import { doNothingAgent } from '../../src/agents/doNothingAgent.js'
import { randomAgent } from '../../src/agents/randomAgent.js'
import type { RawMetrics } from '../../src/evaluation/RawMetrics.js'
import { simulateGame } from '../../src/evaluation/simulateGame.js'

const seeds = [
  'baseline-1',
  'baseline-2',
  'baseline-3',
  'baseline-4',
  'baseline-5',
]

interface BaselineResults {
  doNothing: RawMetrics
  random: RawMetrics
}

function runBaseline(seed: string): BaselineResults {
  const config = { maxTicks: 3000, dtMs: 33 }
  return {
    doNothing: simulateGame(doNothingAgent, config, seed),
    random: simulateGame(randomAgent, config, seed),
  }
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

describe('baseline benchmarks', () => {
  let allResults: BaselineResults[] = []

  beforeAll(() => {
    allResults = seeds.map(runBaseline)
  })

  it('random consistently outperforms doNothing on score means', () => {
    const randomScore = mean(allResults.map((r) => r.random.score))
    const doNothingScore = mean(allResults.map((r) => r.doNothing.score))
    expect(randomScore).toBeGreaterThan(doNothingScore)
  })

  it('random produces non-zero interaction signals', () => {
    const randomShots = mean(allResults.map((r) => r.random.shotsFired))
    const randomDistance = mean(
      allResults.map((r) => r.random.distanceTraveled)
    )
    expect(randomShots).toBeGreaterThan(0)
    expect(randomDistance).toBeGreaterThan(0)
  })
})
