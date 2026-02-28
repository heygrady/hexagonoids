import { PLAYER_STARTING_LIVES } from '@heygrady/hexagonoids-engine'

import type {
  FitnessWeights,
  GateConfig,
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
 * Survival gate: penalizes deaths using exponential decay.
 * 0 deaths → 1.0, more deaths → decays toward floor.
 * Formula: max(exp(-deaths / deathScale), floor)
 */
export function survivalGate(
  metrics: RawMetrics,
  gateConfig: GateConfig,
  _simConfig: Pick<SimulationConfig, 'maxTicks' | 'dtMs'>
): number {
  const raw = Math.exp(-metrics.deaths / Math.max(gateConfig.deathScale, 1e-9))
  return Math.max(raw, gateConfig.floor)
}

/**
 * Fitness context for passing scenario-derived data to the fitness function.
 */
export interface FitnessContext {
  /** Total possible deaths across all scenarios (sum of starting lives). */
  possibleDeaths?: number
}

/**
 * Compute multiplicative fitness for a single agent.
 *
 * Formula (geometric mean × action gate):
 *   scoreNorm     = saturating(score, 5000)
 *   rocksNorm     = saturating(rocksDestroyed, 15)
 *   accuracyTerm  = accuracy + 0.01
 *   survivalTerm  = 1 - deaths / possibleDeaths
 *   perfScore     = (scoreNorm × rocksNorm × accuracyTerm × survivalTerm) ^ 0.25
 *   fitness       = perfScore × actionDiversityGate
 *
 * Zero in any dimension collapses fitness toward zero, giving NEAT a
 * strong gradient to develop all capabilities simultaneously.
 */
export function weightedFitnessSum(
  metrics: RawMetrics,
  _weights: FitnessWeights,
  _config: Pick<SimulationConfig, 'maxTicks' | 'dtMs'>,
  gateConfig: GateConfig,
  context?: FitnessContext
): number {
  const possibleDeaths = context?.possibleDeaths ?? PLAYER_STARTING_LIVES

  // Performance components (all in [0, 1])
  const scoreNorm = saturating(metrics.score, 5000)
  const rocksNorm = saturating(metrics.rocksDestroyed, 15)
  const accuracyTerm = metrics.accuracy + 0.01
  const survivalTerm =
    possibleDeaths > 0 ? clamp(1 - metrics.deaths / possibleDeaths, 0, 1) : 1

  // Geometric mean of 4 performance components
  const perfScore =
    (scoreNorm * rocksNorm * accuracyTerm * survivalTerm) ** 0.25

  // Action diversity gate
  const actionGate = actionDiversityGate(metrics, gateConfig)

  return clamp(perfScore * actionGate, 0, 1)
}

/**
 * Population-level Z-score fitness.
 * Computes per-organism gated fitness, then Z-scores across population.
 */
export function calculateFitness(
  allMetrics: RawMetrics[],
  weights?: Partial<FitnessWeights>,
  gateConfig?: Partial<GateConfig>,
  simConfig?: Partial<SimulationConfig>,
  context?: FitnessContext
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
  const sc: SimulationConfig = {
    ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation,
    ...simConfig,
  }

  // Compute raw fitness per organism
  const rawFitness = allMetrics.map((m) =>
    weightedFitnessSum(m, w, sc, gc, context)
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
