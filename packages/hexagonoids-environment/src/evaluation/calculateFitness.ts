import { PLAYER_STARTING_LIVES } from '@heygrady/hexagonoids-engine'

import type {
  FitnessWeights,
  GateConfig,
  GateEasing,
} from '../HexagonoidsEnvironmentConfig.js'
import { DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG } from '../HexagonoidsEnvironmentConfig.js'
import type { RawMetrics } from './RawMetrics.js'

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

// ── Easing functions ─────────────────────────────────────────────────

/** easeIn: slow start, accelerating. t in [0,1] → [0,1]. */
function easeInLinear(t: number): number {
  return t
}
function easeInQuad(t: number): number {
  return t * t
}
function easeInCubic(t: number): number {
  return t * t * t
}
function easeInExp(t: number): number {
  return t <= 0 ? 0 : 2 ** (10 * t - 10)
}
function easeInCircle(t: number): number {
  return 1 - Math.sqrt(1 - t * t)
}

/** easeOut: fast start, decelerating. t in [0,1] → [0,1]. */
function easeOutLinear(t: number): number {
  return t
}
function easeOutQuad(t: number): number {
  return t * (2 - t)
}
function easeOutCubic(t: number): number {
  const u = 1 - t
  return 1 - u * u * u
}
function easeOutExp(t: number): number {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t)
}
function easeOutCircle(t: number): number {
  const u = t - 1
  return Math.sqrt(1 - u * u)
}

type EasingFn = (t: number) => number

const EASE_IN: Record<GateEasing, EasingFn> = {
  linear: easeInLinear,
  quad: easeInQuad,
  cubic: easeInCubic,
  exp: easeInExp,
  circle: easeInCircle,
}

const EASE_OUT: Record<GateEasing, EasingFn> = {
  linear: easeOutLinear,
  quad: easeOutQuad,
  cubic: easeOutCubic,
  exp: easeOutExp,
  circle: easeOutCircle,
}

// ── Gate helpers ──────────────────────────────────────────────────────

/**
 * Per-action saturation score using named easing curves.
 *
 * Returns ~1.0 when usage fraction is between low..high.
 * - **Low side** (fraction 0→low): `easeOut(t)` where `t = fraction/low`
 * - **High side** (fraction high→1): `1 - easeIn(t)` where `t = (fraction-high)/(1-high)`
 */
function actionSaturationScore(
  actionFrames: number,
  aliveFrames: number,
  low: number,
  high: number,
  easing: GateEasing
): number {
  if (aliveFrames <= 0) return 0
  const fraction = actionFrames / aliveFrames

  const easeOut = EASE_OUT[easing]
  const easeIn = EASE_IN[easing]

  // Low side: ramp from 0 to 1 as fraction goes 0→low
  const lowScore = fraction >= low ? 1 : easeOut(fraction / Math.max(low, 1e-9))

  // High side: ramp from 1 to 0 as fraction goes high→1
  const highScore =
    fraction <= high ? 1 : 1 - easeIn((fraction - high) / (1 - high + 1e-9))

  return lowScore * highScore
}

/**
 * Action diversity gate: geometric mean of 4 action saturation scores.
 * A single action pegged at 100% drives this toward 0.
 */
export function actionDiversityGate(
  metrics: RawMetrics,
  gateConfig: GateConfig
): number {
  const { actionLow, actionHigh, actionEasing, actionGateFloor } = gateConfig
  const alive = metrics.aliveFrames

  const thrust = actionSaturationScore(
    metrics.thrustFrames,
    alive,
    actionLow,
    actionHigh,
    actionEasing
  )
  const fire = actionSaturationScore(
    metrics.fireFrames,
    alive,
    actionLow,
    actionHigh,
    actionEasing
  )
  const left = actionSaturationScore(
    metrics.leftFrames,
    alive,
    actionLow,
    actionHigh,
    actionEasing
  )
  const right = actionSaturationScore(
    metrics.rightFrames,
    alive,
    actionLow,
    actionHigh,
    actionEasing
  )

  const geoMean = (thrust * fire * left * right) ** 0.25
  return Math.max(geoMean, actionGateFloor)
}

/**
 * Turn gate: ensures agents actually steer, not just feather thrust.
 * Uses combined (left + right) turn fraction through the same saturation
 * curve as the action gate. Agents that never turn get gated hard.
 */
export function turnGate(metrics: RawMetrics, gateConfig: GateConfig): number {
  const { turnLow, turnHigh, turnEasing, turnFloor } = gateConfig
  const alive = metrics.aliveFrames
  const turnFrames = metrics.leftFrames + metrics.rightFrames
  const score = actionSaturationScore(
    turnFrames,
    alive,
    turnLow,
    turnHigh,
    turnEasing
  )
  return Math.max(score, turnFloor)
}

/**
 * Turn bias gate: penalizes agents that turn predominantly in one direction.
 * Measures max(left, right) / (left + right). Returns 1.0 when balanced or
 * below threshold; eases toward floor as bias approaches 1.0.
 * Returns 1.0 when agent doesn't turn (turnGate handles that case).
 */
export function turnBiasGate(
  metrics: RawMetrics,
  gateConfig: GateConfig
): number {
  const { turnBiasGateFloor, turnBiasMax, turnBiasEasing } = gateConfig
  const totalTurns = metrics.leftFrames + metrics.rightFrames
  if (totalTurns <= 0) return 1.0

  const bias = Math.max(metrics.leftFrames, metrics.rightFrames) / totalTurns

  if (bias <= turnBiasMax) return 1.0

  const easeIn = EASE_IN[turnBiasEasing]
  const t = (bias - turnBiasMax) / (1 - turnBiasMax + 1e-9)
  const score = 1 - easeIn(clamp(t, 0, 1))
  return Math.max(score, turnBiasGateFloor)
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
  if (metrics.aliveFrames <= 0) return gateConfig.actionGateFloor
  const soiFraction = clamp(
    metrics.framesWithRocksInSOI / metrics.aliveFrames,
    0,
    1
  )
  return Math.max(soiFraction, gateConfig.actionGateFloor)
}

/**
 * Fitness context for passing scenario-derived data to the fitness function.
 */
export interface FitnessContext {
  /** Total possible deaths across all scenarios (sum of starting lives). */
  possibleDeaths?: number
}

/**
 * Compute weighted-sum fitness for a single agent.
 *
 * Formula (weighted sum × gates):
 *   rocksNorm     = clamp(rocksDestroyed / (uniqueRocksSeen × 0.5), 0, 1)
 *   accuracyTerm  = accuracy                          // [0, 1]
 *   survivalGate  = clamp(1 - deaths / possibleDeaths, 0, 1)
 *   perfScore     = w1 × rocksNorm + w2 × accuracyTerm
 *   fitness       = clamp(perfScore × actionGate × turnGate × turnBiasGate × survivalGate, 0, 1)
 *
 * Killing half the rocks you see maxes rocksNorm. Survival is a
 * multiplicative gate: dying heavily punishes fitness.
 */
export function weightedFitnessSum(
  metrics: RawMetrics,
  weights: FitnessWeights,
  gateConfig: GateConfig,
  context: FitnessContext
): number {
  const possibleDeaths = context.possibleDeaths ?? PLAYER_STARTING_LIVES + 1

  // Performance components (all in [0, 1])
  // Killing half the rocks seen maxes out the score.
  const effectiveMaxRocks = Math.max(1, metrics.uniqueRocksSeen * 0.5)
  const rocksNorm = clamp(metrics.rocksDestroyed / effectiveMaxRocks, 0, 1)
  const accuracyTerm = metrics.accuracy
  const survivalRaw =
    possibleDeaths > 0 ? clamp(1 - metrics.deaths / possibleDeaths, 0, 1) : 1
  const survivalGate = Math.max(survivalRaw, gateConfig.survivalGateFloor)

  // Weighted sum of performance components
  const perfScore =
    weights.rocksDestroyed * rocksNorm + weights.accuracy * accuracyTerm

  // Gates (multiplicative)
  const actionGate = actionDiversityGate(metrics, gateConfig)
  const turn = turnGate(metrics, gateConfig)
  const turnBias = turnBiasGate(metrics, gateConfig)

  return clamp(perfScore * actionGate * turn * turnBias * survivalGate, 0, 1)
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
    {}
  )
}
