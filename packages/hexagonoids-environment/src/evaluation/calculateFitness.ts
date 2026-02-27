import {
  PLAYER_STARTING_LIVES,
  ROCK_TOTAL_VALUE,
} from '@heygrady/hexagonoids-engine'

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
  if (stdDev === 0) return 0
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
 * Engagement gate: did the agent actually interact with rocks?
 * Combines rock observation breadth with accuracy.
 */
export function engagementGate(
  metrics: RawMetrics,
  gateConfig: GateConfig
): number {
  const totalRocks =
    metrics.largeRocksSpawned > 0 ? metrics.largeRocksSpawned : 1
  const seenRatio = clamp(metrics.uniqueRocksSeen / totalRocks, 0, 1)
  const accuracyFactor =
    metrics.shotsFired > 0 ? clamp(metrics.accuracy, 0, 1) : 0
  const raw = seenRatio * Math.max(accuracyFactor, 0.2)
  return Math.max(raw, gateConfig.floor)
}

/**
 * Survival gate: fraction of total time survived.
 */
export function survivalGate(
  metrics: RawMetrics,
  gateConfig: GateConfig,
  simConfig: SimulationConfig
): number {
  const maxTime = simConfig.maxTicks * simConfig.dtMs
  const raw = maxTime > 0 ? clamp(metrics.timeAlive / maxTime, 0, 1) : 0
  return Math.max(raw, gateConfig.floor)
}

/**
 * Cells visited score: capped coverage curve.
 */
function cellsVisitedScore(
  uniqueCells: number,
  gateConfig: GateConfig
): number {
  const target = gateConfig.cellsCoverageTarget
  if (target <= 0) return 0
  return clamp(uniqueCells / target, 0, 1)
}

/**
 * Quality score: weighted sum of 5 normalized components, range [0, 1].
 */
function qualityScore(
  metrics: RawMetrics,
  weights: FitnessWeights,
  simConfig: SimulationConfig,
  gateConfig: GateConfig
): number {
  const maxTime = simConfig.maxTicks * simConfig.dtMs

  // Score efficiency: saturating transform of game score
  const scoreComponent = saturating(metrics.score, ROCK_TOTAL_VALUE * 10)

  // Lives remaining: fraction of starting lives
  const livesComponent = clamp(
    metrics.livesRemaining / PLAYER_STARTING_LIVES,
    0,
    1
  )

  // Accuracy with reliability scaling
  const accuracyReliability = clamp(metrics.shotsFired / 15, 0, 1)
  const accuracyComponent = clamp(metrics.accuracy, 0, 1) * accuracyReliability

  // Rocks destroyed: saturating curve
  const rocksComponent = saturating(metrics.rocksDestroyed, 25)

  // Cells visited
  const cellsComponent = cellsVisitedScore(
    metrics.uniqueCellsVisited,
    gateConfig
  )

  const weightSum =
    weights.scoreEfficiency +
    weights.livesRemaining +
    weights.accuracy +
    weights.rocksDestroyed +
    weights.cellsVisited

  if (weightSum <= 0) return 0

  const base =
    weights.scoreEfficiency * scoreComponent +
    weights.livesRemaining * livesComponent +
    weights.accuracy * accuracyComponent +
    weights.rocksDestroyed * rocksComponent +
    weights.cellsVisited * cellsComponent

  // Add survival modulation
  const timeComponent =
    maxTime > 0 ? clamp(metrics.timeAlive / maxTime, 0, 1) : 0
  const survivalModifier = 0.35 + 0.65 * timeComponent

  return clamp((base / weightSum) * survivalModifier, 0, 1)
}

/**
 * Compute gated fitness for a single agent.
 * Formula: qualityScore * actionDiversityGate * engagementGate * survivalGate
 */
export function weightedFitnessSum(
  metrics: RawMetrics,
  weights: FitnessWeights,
  config: SimulationConfig,
  gateConfig: GateConfig
): number {
  const quality = qualityScore(metrics, weights, config, gateConfig)
  const actionGate = actionDiversityGate(metrics, gateConfig)
  const engagement = engagementGate(metrics, gateConfig)
  const survival = survivalGate(metrics, gateConfig, config)

  return clamp(quality * actionGate * engagement * survival, 0, 1)
}

/**
 * Population-level Z-score fitness.
 * Computes per-organism gated fitness, then Z-scores across population.
 */
export function calculateFitness(
  allMetrics: RawMetrics[],
  weights?: Partial<FitnessWeights>,
  gateConfig?: Partial<GateConfig>,
  simConfig?: Partial<SimulationConfig>
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
  const rawFitness = allMetrics.map((m) => weightedFitnessSum(m, w, sc, gc))

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
