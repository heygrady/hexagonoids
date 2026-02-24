import {
  MAX_SPEED,
  PLAYER_STARTING_LIVES,
  ROCK_TOTAL_VALUE,
  ROCK_WAVE_SIZES,
} from '@heygrady/hexagonoids-engine'

import type {
  FitnessWeights,
  SimulationConfig,
} from '../HexagonoidsEnvironmentConfig.js'
import { DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG } from '../HexagonoidsEnvironmentConfig.js'
import type { RawMetrics } from './RawMetrics.js'

interface NormalizationBounds {
  maxScore: number
  maxDistance: number
  maxTimeAlive: number
  maxLives: number
  maxRocksDestroyed: number
}

function computeNormalizationBounds(
  config: SimulationConfig
): NormalizationBounds {
  // MAX_POSSIBLE_SCORE: all large rocks across all waves fully cleared
  // Each large rock yields ROCK_TOTAL_VALUE (large + 2 medium + 4 small)
  const totalLargeRocks = ROCK_WAVE_SIZES.reduce((sum, count) => sum + count, 0)
  const maxScore = totalLargeRocks * ROCK_TOTAL_VALUE

  // MAX_DISTANCE: MAX_SPEED (rad/s) * total time (s)
  const totalTimeSeconds = (config.maxTicks * config.dtMs) / 1000
  const maxDistance = MAX_SPEED * totalTimeSeconds

  // MAX_TIME_ALIVE: total simulation duration in ms
  const maxTimeAlive = config.maxTicks * config.dtMs

  const maxLives = PLAYER_STARTING_LIVES

  // Total rocks if all waves fully cleared (large + 2 medium + 4 small per large rock)
  const maxRocksDestroyed = totalLargeRocks * 7

  return { maxScore, maxDistance, maxTimeAlive, maxLives, maxRocksDestroyed }
}

/**
 * Compute weighted fitness for a single agent using pre-normalized components.
 * Each component is divided by its known upper bound, then multiplied by its weight.
 */
export function weightedFitnessSum(
  metrics: RawMetrics,
  weights: FitnessWeights,
  config: SimulationConfig
): number {
  const bounds = computeNormalizationBounds(config)

  const normScore = bounds.maxScore > 0 ? metrics.score / bounds.maxScore : 0
  const normLives =
    bounds.maxLives > 0 ? metrics.livesRemaining / bounds.maxLives : 0
  const normAccuracy = metrics.accuracy // already 0–1
  const normDistance =
    bounds.maxDistance > 0 ? metrics.distanceTraveled / bounds.maxDistance : 0
  const normRocks =
    bounds.maxRocksDestroyed > 0
      ? metrics.rocksDestroyed / bounds.maxRocksDestroyed
      : 0
  const normTime =
    bounds.maxTimeAlive > 0 ? metrics.timeAlive / bounds.maxTimeAlive : 0

  return (
    weights.score * normScore +
    weights.livesRemaining * normLives +
    weights.accuracy * normAccuracy +
    weights.distanceTraveled * normDistance +
    weights.rocksDestroyed * normRocks +
    weights.timeAlive * normTime
  )
}

/**
 * Z-score: (value - mean) / stdDev.
 * Returns 0 when stdDev is 0 (no discriminating signal).
 */
export function zScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0
  return (value - mean) / stdDev
}

/**
 * Population-level Z-score fitness (NERO/Stanley approach).
 * For each of 6 components: compute population mean/stdDev, convert to Z-scores,
 * multiply by weight, sum across components.
 */
export function calculateFitness(
  allMetrics: RawMetrics[],
  weights?: Partial<FitnessWeights>
): number[] {
  const n = allMetrics.length
  if (n === 0) return []

  const w: FitnessWeights = {
    ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fitnessWeights,
    ...weights,
  }

  // Extract raw component arrays
  const components: { key: keyof FitnessWeights; values: number[] }[] = [
    { key: 'score', values: allMetrics.map((m) => m.score) },
    { key: 'livesRemaining', values: allMetrics.map((m) => m.livesRemaining) },
    { key: 'accuracy', values: allMetrics.map((m) => m.accuracy) },
    {
      key: 'distanceTraveled',
      values: allMetrics.map((m) => m.distanceTraveled),
    },
    { key: 'rocksDestroyed', values: allMetrics.map((m) => m.rocksDestroyed) },
    { key: 'timeAlive', values: allMetrics.map((m) => m.timeAlive) },
  ]

  // Initialize fitness array
  const fitness = new Array<number>(n).fill(0)

  for (const { key, values } of components) {
    // Compute mean
    let sum = 0
    for (const v of values) {
      sum += v
    }
    const mean = sum / n

    // Compute stdDev
    let sqSum = 0
    for (const v of values) {
      sqSum += (v - mean) ** 2
    }
    const stdDev = Math.sqrt(sqSum / n)

    // Accumulate weighted Z-scores
    const weight = w[key]
    for (let i = 0; i < n; i++) {
      fitness[i] =
        (fitness[i] ?? 0) + weight * zScore(values[i] ?? 0, mean, stdDev)
    }
  }

  return fitness
}
