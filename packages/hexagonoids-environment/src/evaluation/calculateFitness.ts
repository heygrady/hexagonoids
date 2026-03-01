import { PLAYER_STARTING_LIVES } from '@heygrady/hexagonoids-engine'

import type {
  FitnessWeights,
  GateConfig,
} from '../HexagonoidsEnvironmentConfig.js'
import { DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG } from '../HexagonoidsEnvironmentConfig.js'
import type { RawMetrics } from './RawMetrics.js'
import { fullGameMaximums } from './scenarioContext.js'

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Z-score: (value - mean) / stdDev.
 * Returns 0 when stdDev is 0 (no discriminating signal).
 */
export function zScore(value: number, mean: number, stdDev: number): number {
  if (stdDev < 1e-12) return 0
  return (value - mean) / stdDev
}

// ── Gate helpers ──────────────────────────────────────────────────────

/**
 * Per-action saturation score.
 * Returns ~1.0 when usage fraction is between low..high,
 * drops toward 0 when saturated (near 100%) or never used (0%).
 */
function actionSaturationScore(
  actionFrames: number,
  aliveFrames: number,
  low: number,
  high: number,
  steepness: number
): number {
  if (aliveFrames <= 0) return 0
  const fraction = actionFrames / aliveFrames
  // Penalty for never pressing: smooth ramp from 0 to 1
  const lowPenalty = 1 - Math.exp(-steepness * (fraction / Math.max(low, 1e-9)))
  // Penalty for over-pressing: smooth ramp from 1 to 0
  const highPenalty =
    fraction <= high
      ? 1
      : Math.exp(-steepness * ((fraction - high) / (1 - high + 1e-9)))
  return lowPenalty * highPenalty
}

/**
 * Action diversity gate: geometric mean of 4 action saturation scores.
 * A single action pegged at 100% drives this toward 0.
 */
export function actionDiversityGate(
  metrics: RawMetrics,
  gateConfig: GateConfig
): number {
  const { actionLow, actionHigh, actionSteepness, floor } = gateConfig
  const alive = metrics.aliveFrames

  const thrust = actionSaturationScore(
    metrics.thrustFrames,
    alive,
    actionLow,
    actionHigh,
    actionSteepness
  )
  const fire = actionSaturationScore(
    metrics.fireFrames,
    alive,
    actionLow,
    actionHigh,
    actionSteepness
  )
  const left = actionSaturationScore(
    metrics.leftFrames,
    alive,
    actionLow,
    actionHigh,
    actionSteepness
  )
  const right = actionSaturationScore(
    metrics.rightFrames,
    alive,
    actionLow,
    actionHigh,
    actionSteepness
  )

  const geoMean = (thrust * fire * left * right) ** 0.25
  return Math.max(geoMean, floor)
}

/**
 * Turn gate: ensures agents actually steer, not just feather thrust.
 * Uses combined (left + right) turn fraction through the same saturation
 * curve as the action gate. Agents that never turn get gated hard.
 */
export function turnGate(metrics: RawMetrics, gateConfig: GateConfig): number {
  const { turnLow, turnHigh, turnSteepness, turnFloor } = gateConfig
  const alive = metrics.aliveFrames
  const turnFrames = metrics.leftFrames + metrics.rightFrames
  const score = actionSaturationScore(
    turnFrames,
    alive,
    turnLow,
    turnHigh,
    turnSteepness
  )
  return Math.max(score, turnFloor)
}

/**
 * Engagement gate: did the agent spend time near rocks?
 * Measures what fraction of alive frames had rocks within the sphere of
 * influence (SOI). Produces a smooth gradient — agents that actively seek
 * out rocks score higher than those that drift or spin in place.
 */
export function engagementGate(
  metrics: RawMetrics,
  gateConfig: GateConfig
): number {
  if (metrics.aliveFrames <= 0) return gateConfig.floor
  const soiFraction = clamp(
    metrics.framesWithRocksInSOI / metrics.aliveFrames,
    0,
    1
  )
  return Math.max(soiFraction, gateConfig.floor)
}

/**
 * Fitness context for passing scenario-derived data to the fitness function.
 */
export interface FitnessContext {
  /** Total possible deaths across all scenarios (sum of starting lives). */
  possibleDeaths?: number
  /** Maximum destroyable rocks for the scenario/game rock composition. */
  maxRocksDestroyed: number
}

/**
 * Compute weighted-sum fitness for a single agent.
 *
 * Formula (weighted sum × action gate):
 *   rocksNorm     = clamp(rocksDestroyed / maxRocksDestroyed, 0, 1)
 *   accuracyTerm  = accuracy                          // [0, 1]
 *   survivalTerm  = clamp(1 - deaths / possibleDeaths, 0, 1)
 *   perfScore     = w1 × rocksNorm + w2 × accuracyTerm + w3 × survivalTerm
 *   fitness       = clamp(perfScore × actionDiversityGate × turnGate, 0, 1)
 *
 * The weighted sum provides gradient everywhere — an agent with zero kills
 * but nonzero accuracy still receives a fitness signal.
 */
export function weightedFitnessSum(
  metrics: RawMetrics,
  weights: FitnessWeights,
  gateConfig: GateConfig,
  context: FitnessContext
): number {
  const possibleDeaths = context.possibleDeaths ?? PLAYER_STARTING_LIVES

  // Performance components (all in [0, 1])
  const rocksNorm =
    context.maxRocksDestroyed > 0
      ? clamp(metrics.rocksDestroyed / context.maxRocksDestroyed, 0, 1)
      : 1
  const accuracyTerm = metrics.accuracy
  const survivalTerm =
    possibleDeaths > 0 ? clamp(1 - metrics.deaths / possibleDeaths, 0, 1) : 1

  // Weighted sum of performance components
  const perfScore =
    weights.rocksDestroyed * rocksNorm +
    weights.accuracy * accuracyTerm +
    weights.survival * survivalTerm

  // Gates
  const actionGate = actionDiversityGate(metrics, gateConfig)
  const turn = turnGate(metrics, gateConfig)

  return clamp(perfScore * actionGate * turn, 0, 1)
}

/**
 * Population-level Z-score fitness.
 * Computes per-organism gated fitness, then Z-scores across population.
 */
export function calculateFitness(
  allMetrics: RawMetrics[],
  context: FitnessContext,
  weights?: Partial<FitnessWeights>,
  gateConfig?: Partial<GateConfig>
): number[] {
  const n = allMetrics.length
  if (n === 0) return []

  const w: FitnessWeights = {
    ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fitnessWeights,
    ...weights,
  }
  const gc: GateConfig = {
    ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.gateConfig,
    ...gateConfig,
  }

  // Compute raw fitness per organism
  const rawFitness = allMetrics.map((m) =>
    weightedFitnessSum(m, w, gc, context)
  )

  // Compute mean
  let sum = 0
  for (const f of rawFitness) {
    sum += f
  }
  const mean = sum / n

  // Compute stdDev
  let sqSum = 0
  for (const f of rawFitness) {
    sqSum += (f - mean) ** 2
  }
  const stdDev = Math.sqrt(sqSum / n)

  // Z-score
  return rawFitness.map((f) => zScore(f, mean, stdDev))
}

/**
 * Convenience: evaluate a single agent's fitness using full-game defaults.
 * Uses default weights, gate config, and full-game context (wave 0, 4 large rocks).
 */
export function evaluateFullGameFitness(metrics: RawMetrics): number {
  return weightedFitnessSum(
    metrics,
    DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fitnessWeights,
    DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.gateConfig,
    fullGameMaximums()
  )
}
