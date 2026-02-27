import {
  PLAYER_STARTING_LIVES,
  RADIUS,
  ROCK_TOTAL_VALUE,
} from '@heygrady/hexagonoids-engine'

import type {
  FitnessWeights,
  SimulationConfig,
} from '../HexagonoidsEnvironmentConfig.js'
import { DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG } from '../HexagonoidsEnvironmentConfig.js'
import type { RawMetrics } from './RawMetrics.js'

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function saturating(value: number, scale: number): number {
  if (value <= 0 || scale <= 0) return 0
  return 1 - Math.exp(-value / scale)
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
  const rewardSigmoid = 1 / (1 + Math.exp(-metrics.episodeReward / 220))
  const rewardComponent = clamp(rewardSigmoid * 2 - 1, 0, 1)

  // Saturating transforms keep the objective sensitive at low-mid performance
  // while preventing single metrics from dominating late-game.
  const scoreComponent = saturating(metrics.score, ROCK_TOTAL_VALUE * 10)
  const rocksComponent = saturating(metrics.rocksDestroyed, 25)
  const distanceComponent = saturating(metrics.distanceTraveled, RADIUS * 10)
  const timeComponent = clamp(
    metrics.timeAlive / (config.maxTicks * config.dtMs),
    0,
    1
  )
  const livesComponent = clamp(
    metrics.livesRemaining / PLAYER_STARTING_LIVES,
    0,
    1
  )

  // Avoid over-rewarding random spray with tiny sample counts.
  const accuracyReliability = clamp(metrics.shotsFired / 15, 0, 1)
  const accuracyComponent = clamp(metrics.accuracy, 0, 1) * accuracyReliability

  const weightSum =
    weights.score +
    weights.livesRemaining +
    weights.accuracy +
    weights.distanceTraveled +
    weights.rocksDestroyed +
    weights.timeAlive

  const base =
    weights.score * scoreComponent +
    weights.livesRemaining * livesComponent +
    weights.accuracy * accuracyComponent +
    weights.distanceTraveled * distanceComponent +
    weights.rocksDestroyed * rocksComponent +
    weights.timeAlive * timeComponent

  const normalizedBase = weightSum > 0 ? base / weightSum : 0

  // Survival and control penalties to discourage degenerate policies.
  const deathPenalty = clamp(metrics.deaths / PLAYER_STARTING_LIVES, 0, 1)
  const sprayPenalty =
    metrics.shotsFired > 0
      ? (1 - clamp(metrics.accuracy, 0, 1)) *
        clamp(metrics.shotsFired / 220, 0, 1)
      : 0
  const survivalGate = 0.35 + 0.65 * timeComponent

  const shaped = clamp(
    normalizedBase *
      survivalGate *
      (1 - 0.35 * deathPenalty) *
      (1 - 0.2 * sprayPenalty),
    0,
    1
  )

  return clamp(0.7 * rewardComponent + 0.3 * shaped, 0, 1)
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
