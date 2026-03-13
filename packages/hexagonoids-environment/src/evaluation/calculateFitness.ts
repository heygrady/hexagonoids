import {
  ACCELERATION_RATE,
  BULLET_TRAVEL_DISTANCE,
  FIRE_COOLDOWN,
  PLAYER_STARTING_LIVES,
  TURN_RATE,
} from '@heygrady/hexagonoids-engine'
import type {
  FitnessWeights,
  GateConfig,
  GateEasing,
} from '../HexagonoidsEnvironmentConfig.js'
import { DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG } from '../HexagonoidsEnvironmentConfig.js'
import { SOI_ANGULAR_RADIUS } from '../utils/constants.js'
import type { RawMetrics } from './RawMetrics.js'
import { computePossibleDeaths } from './scenarioContext.js'

/** The frame-count fields that behavioral gates need. */
export type ActionFrames = Pick<
  RawMetrics,
  'thrustFrames' | 'fireFrames' | 'leftFrames' | 'rightFrames' | 'aliveFrames'
>

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
  metrics: ActionFrames,
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
export function turnGate(
  metrics: ActionFrames,
  gateConfig: GateConfig
): number {
  const { turnLow, turnHigh, turnEasing, turnGateFloor } = gateConfig
  const alive = metrics.aliveFrames
  const turnFrames = metrics.leftFrames + metrics.rightFrames
  const score = actionSaturationScore(
    turnFrames,
    alive,
    turnLow,
    turnHigh,
    turnEasing
  )
  return Math.max(score, turnGateFloor)
}

/**
 * Throttle gate: ensures agents actually thrust, not just spin and shoot.
 * Uses thrust frame fraction through the same saturation curve as the other
 * gates. Agents that never or always thrust get gated.
 */
export function throttleGate(
  metrics: ActionFrames,
  gateConfig: GateConfig
): number {
  const { throttleLow, throttleHigh, throttleEasing, throttleGateFloor } =
    gateConfig
  const alive = metrics.aliveFrames
  const score = actionSaturationScore(
    metrics.thrustFrames,
    alive,
    throttleLow,
    throttleHigh,
    throttleEasing
  )
  return Math.max(score, throttleGateFloor)
}

/**
 * Turn bias gate: penalizes agents that turn predominantly in one direction.
 * Measures max(left, right) / (left + right). Returns 1.0 when balanced or
 * below threshold; eases toward floor as bias approaches 1.0.
 * Returns 1.0 when agent doesn't turn (turnGate handles that case).
 */
export function turnBiasGate(
  metrics: ActionFrames,
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
  /** Tick duration in milliseconds (needed for fire-rate-based rock denominator). */
  dtMs?: number
}

/**
 * Compute the physics-based kill cycle length in ticks.
 *
 * One kill cycle = fire cooldown + 180° turn + accelerate from standstill
 * until SOI edge reaches firing range. At dtMs=33 this works out to ~48 ticks
 * (~1.6 seconds per kill).
 */
const killCycleCache: Map<number, number> = new Map()
export function computeKillCycleTicks(dtMs: number): number {
  let killCycle = killCycleCache.get(dtMs)
  if (killCycle !== undefined) {
    return killCycle
  }
  const dtS = dtMs / 1000
  const shotCooldownTicks = Math.ceil(FIRE_COOLDOWN / dtMs)
  const halfTurnTicks = Math.ceil(Math.PI / TURN_RATE / dtS)
  const distanceToTravel = Math.max(
    0,
    SOI_ANGULAR_RADIUS - BULLET_TRAVEL_DISTANCE
  )
  const accelTimeS =
    distanceToTravel > 0
      ? Math.sqrt((2 * distanceToTravel) / ACCELERATION_RATE)
      : 0
  const accelTicks = Math.ceil(accelTimeS / dtS)
  killCycle = shotCooldownTicks + halfTurnTicks + accelTicks
  killCycleCache.set(dtMs, killCycle)
  return killCycle
}

/**
 * Compute the physics-based rock kill budget for a given elapsed time.
 *
 * `possibleKills = min(floor(elapsedTicks / killCycleTicks), uniqueRocksSeen)`
 *
 * The kill cycle (~48 ticks at 33ms) represents the time to fire, turn 180°,
 * and close distance to the next rock. This auto-scales with scenario length:
 * short scenarios get a small budget (1 kill in 32 ticks), while long games
 * are capped by rocks actually encountered.
 */
export function computePossibleKills(
  elapsedTicks: number,
  dtMs: number,
  uniqueRocksSeen: number
): number {
  const killCycle = computeKillCycleTicks(dtMs)
  const rateCap = Math.floor(elapsedTicks / killCycle)
  return Math.max(1, Math.min(rateCap, uniqueRocksSeen))
}

/**
 * Compute weighted-sum fitness for a single episode.
 *
 * Formula (weighted sum × survival gate):
 *   possibleKills = min(elapsedTicks × shotsPerTick × targetAccuracy, uniqueRocksSeen)
 *   rocksNorm     = clamp(rocksDestroyed / possibleKills, 0, 1)
 *   accuracyTerm  = clamp(accuracy / targetAccuracy, 0, 1)
 *   survivalGate  = clamp(1 - deaths / possibleDeaths, 0, 1)
 *   perfScore     = w1 × rocksNorm + w2 × accuracyTerm
 *   fitness       = clamp(perfScore × survivalGate, 0, 1)
 *
 * Behavioral gates (action diversity, turn, turn bias) are applied at the
 * aggregated level via `applyBehavioralGates` after all episodes complete.
 * This prevents unfair per-episode penalties in short focused scenarios.
 */
export function weightedFitnessSum(
  metrics: RawMetrics,
  weights: FitnessWeights,
  gateConfig: GateConfig,
  context: FitnessContext
): number {
  const possibleDeaths = context.possibleDeaths ?? PLAYER_STARTING_LIVES + 1
  const dtMs =
    context.dtMs ?? DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation.dtMs

  // Performance components (all in [0, 1])
  const targetAccuracy =
    weights.targetAccuracy > 0 ? weights.targetAccuracy : 0.2
  const effectiveMaxRocks = computePossibleKills(
    metrics.elapsedTicks,
    dtMs,
    metrics.uniqueRocksSeen
  )
  const rocksNorm = clamp(metrics.rocksDestroyed / effectiveMaxRocks, 0, 1)
  const accuracyTerm = clamp(metrics.accuracy / targetAccuracy, 0, 1)
  const survivalRaw =
    possibleDeaths > 0 ? clamp(1 - metrics.deaths / possibleDeaths, 0, 1) : 1
  const survivalGate = Math.max(survivalRaw, gateConfig.survivalGateFloor)

  // Weighted sum of performance components
  const perfScore =
    weights.rocksDestroyed * rocksNorm + weights.accuracy * accuracyTerm

  return clamp(perfScore * survivalGate, 0, 1)
}

/**
 * Apply behavioral gates on aggregated frame counts across all episodes.
 *
 * Multiplies fitness by action diversity, turn, and turn bias gates computed
 * from total frame counts. This catches agents that consistently exhibit
 * degenerate patterns (e.g. 0% thrust, 100% fire, all-left spinning) without
 * penalizing legitimate focused behavior in short individual scenarios.
 */
export function applyBehavioralGates(
  fitness: number,
  aggregatedMetrics: ActionFrames,
  gateConfig: GateConfig
): number {
  const action = actionDiversityGate(aggregatedMetrics, gateConfig)
  const turn = turnGate(aggregatedMetrics, gateConfig)
  const throttle = throttleGate(aggregatedMetrics, gateConfig)
  const turnBias = turnBiasGate(aggregatedMetrics, gateConfig)
  return clamp(fitness * action * turn * throttle * turnBias, 0, 1)
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

  // Compute raw fitness per organism (all values in [0, 1])
  return allMetrics.map((m) => weightedFitnessSum(m, w, gc, context))
}

/**
 * Convenience: evaluate a single agent's fitness using full-game defaults.
 * Uses default weights, gate config, and time-based possibleDeaths from
 * actual elapsed ticks stored in the metrics.
 */
export function evaluateFullGameFitness(
  metrics: RawMetrics,
  dtMs?: number
): number {
  const dt = dtMs ?? DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation.dtMs
  return weightedFitnessSum(
    metrics,
    DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fitnessWeights,
    DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.gateConfig,
    {
      possibleDeaths: computePossibleDeaths(metrics.elapsedTicks, dt),
      dtMs: dt,
    }
  )
}
