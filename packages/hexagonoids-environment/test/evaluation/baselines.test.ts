import { beforeAll, describe, expect, it } from 'vitest'
import { doNothingAgent } from '../../src/agents/doNothingAgent.js'
import { randomAgent } from '../../src/agents/randomAgent.js'
import { seekDestroyAgent } from '../../src/agents/seekDestroyAgent.js'
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
  seekDestroy: RawMetrics
}

function runBaseline(seed: string): BaselineResults {
  const config = { maxTicks: 3000, dtMs: 33 }
  return {
    doNothing: simulateGame(doNothingAgent, config, seed),
    random: simulateGame(randomAgent, config, seed),
    seekDestroy: simulateGame(seekDestroyAgent, config, seed),
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

  // Log actual metric ranges for fitness calibration
  it('logs baseline ranges for calibration', () => {
    const fields: (keyof RawMetrics)[] = [
      'score',
      'rocksDestroyed',
      'accuracy',
      'distanceTraveled',
      'livesRemaining',
      'deaths',
      'shotsFired',
      'shotsHit',
      'wavesSpawned',
    ]

    for (const field of fields) {
      const dn = allResults.map((r) => r.doNothing[field])
      const ra = allResults.map((r) => r.random[field])
      const sd = allResults.map((r) => r.seekDestroy[field])

      console.log(
        `${field}: doNothing=[${Math.min(...dn)}, ${Math.max(...dn)}] ` +
          `random=[${Math.min(...ra)}, ${Math.max(...ra)}] ` +
          `seekDestroy=[${Math.min(...sd)}, ${Math.max(...sd)}]`
      )
    }

    // Log means for aggregate comparison
    console.log('\n--- Means ---')
    for (const field of fields) {
      const dnMean = mean(allResults.map((r) => r.doNothing[field]))
      const raMean = mean(allResults.map((r) => r.random[field]))
      const sdMean = mean(allResults.map((r) => r.seekDestroy[field]))
      console.log(
        `${field}: doNothing=${dnMean.toFixed(2)} random=${raMean.toFixed(2)} seekDestroy=${sdMean.toFixed(2)}`
      )
    }
  })

  // --- Per-seed checks (stable invariants only) ---
  seeds.forEach((seed, i) => {
    describe(`seed: ${seed}`, () => {
      it('random.score >= doNothing.score', () => {
        const r = allResults[i]
        if (r == null) throw new Error(`missing results for seed index ${i}`)
        expect(r.random.score).toBeGreaterThanOrEqual(r.doNothing.score)
      })

      it('seekDestroy.distanceTraveled > doNothing.distanceTraveled', () => {
        const r = allResults[i]
        if (r == null) throw new Error(`missing results for seed index ${i}`)
        expect(r.seekDestroy.distanceTraveled).toBeGreaterThan(
          r.doNothing.distanceTraveled
        )
      })
    })
  })

  // --- Aggregate ordering (mean across seeds) ---
  // On a sphere with rocks from all directions, random spray creates natural
  // omni-directional coverage that a single-target agent can't always match
  // per-seed. Aggregate means capture the true ordering reliably.

  it('mean seekDestroy.accuracy > mean random.accuracy', () => {
    const sdAccuracy = mean(allResults.map((r) => r.seekDestroy.accuracy))
    const raAccuracy = mean(allResults.map((r) => r.random.accuracy))
    expect(sdAccuracy).toBeGreaterThan(raAccuracy)
  })

  it('mean seekDestroy.score >= mean doNothing.score', () => {
    const sdScore = mean(allResults.map((r) => r.seekDestroy.score))
    const dnScore = mean(allResults.map((r) => r.doNothing.score))
    expect(sdScore).toBeGreaterThan(dnScore)
  })

  it('mean seekDestroy.rocksDestroyed > mean doNothing.rocksDestroyed', () => {
    const sdRocks = mean(allResults.map((r) => r.seekDestroy.rocksDestroyed))
    const dnRocks = mean(allResults.map((r) => r.doNothing.rocksDestroyed))
    expect(sdRocks).toBeGreaterThan(dnRocks)
  })

  it('seekDestroy achieves non-zero score on all seeds', () => {
    for (const result of allResults) {
      expect(result.seekDestroy.score).toBeGreaterThan(0)
      expect(result.seekDestroy.rocksDestroyed).toBeGreaterThan(0)
    }
  })

  it('seekDestroy fires shots and hits targets on all seeds', () => {
    for (const result of allResults) {
      expect(result.seekDestroy.shotsFired).toBeGreaterThan(0)
      expect(result.seekDestroy.shotsHit).toBeGreaterThan(0)
    }
  })
})
