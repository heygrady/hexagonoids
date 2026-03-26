import {
  ACCELERATION_RATE,
  BULLET_TRAVEL_DISTANCE,
  FIRE_COOLDOWN,
  PLAYER_STARTING_LIVES,
  TURN_RATE,
} from '@heygrady/hexagonoids-engine'
import type { CurriculumScenarioParams } from '../curriculum/generateCurriculumScenario.js'
import type {
  ActionGateConfig,
  BehavioralGateConfig,
  FitnessWeights,
  GateConfig,
  GateEasing,
  TurnBiasGateConfig,
} from '../HexagonoidsEnvironmentConfig.js'
import {
  DEFAULT_BEHAVIORAL_GATE_CONFIG,
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
} from '../HexagonoidsEnvironmentConfig.js'
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

// ── Per-action behavioral gates ──────────────────────────────────────

/**
 * Per-action saturation gate with its own low/high/easing/floor.
 * Reuses `actionSaturationScore` but applies a per-action floor.
 */
function perActionGate(
  actionFrames: number,
  aliveFrames: number,
  config: ActionGateConfig
): number {
  const score = actionSaturationScore(
    actionFrames,
    aliveFrames,
    config.low,
    config.high,
    config.easing
  )
  return Math.max(score, config.floor)
}

/**
 * Turn bias gate: penalizes agents that turn predominantly in one direction.
 * Returns 1.0 when balanced or below threshold; eases toward floor as bias
 * approaches 1.0. Returns 1.0 when agent doesn't turn (turn gate handles
 * that case).
 */
function perTurnBiasGate(
  metrics: ActionFrames,
  config: TurnBiasGateConfig
): number {
  const totalTurns = metrics.leftFrames + metrics.rightFrames
  if (totalTurns <= 0) return 1.0

  const bias = Math.max(metrics.leftFrames, metrics.rightFrames) / totalTurns
  if (bias <= config.max) return 1.0

  const easeIn = EASE_IN[config.easing]
  const t = (bias - config.max) / (1 - config.max + 1e-9)
  const score = 1 - easeIn(clamp(t, 0, 1))
  return Math.max(score, config.floor)
}

/**
 * Calculate a single behavioral gate from 4 non-overlapping per-action gates.
 * Each action is counted exactly once. Combined via geometric mean.
 *
 * With per-action floors of 0.3/0.3/0.1/0.1, the worst-case geometric mean
 * is ~0.19, floored at config.floor (default 0.05). This replaces the old
 * system where worst-case was 0.0000002.
 */
export function calculateBehavioralGate(
  metrics: ActionFrames,
  config: BehavioralGateConfig
): number {
  const thrust = perActionGate(
    metrics.thrustFrames,
    metrics.aliveFrames,
    config.thrust
  )
  const fire = perActionGate(
    metrics.fireFrames,
    metrics.aliveFrames,
    config.fire
  )
  const turnFrames = metrics.leftFrames + metrics.rightFrames
  const turn = perActionGate(turnFrames, metrics.aliveFrames, config.turn)
  const bias = perTurnBiasGate(metrics, config.turnBias)

  return Math.max((thrust * fire * turn * bias) ** 0.25, config.floor)
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
  /** Configured episode length in ticks. Used for kill budget so surviving longer doesn't inflate the target. */
  maxTicks?: number
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
 * Compute the physics-based rock kill budget.
 *
 * When `maxTicks` is provided, the budget is based on the configured episode
 * length rather than actual elapsed time. This decouples kill expectations
 * from survival — agents that live longer get more time to meet a fixed
 * target instead of having the target inflate against them.
 *
 * `targetKillRatio` (default 1.0) scales the budget down, analogous to
 * `targetAccuracy`. At 0.5, killing half the physics-based max = perfect.
 */
export function computePossibleKills(
  elapsedTicks: number,
  dtMs: number,
  uniqueRocksSeen: number,
  maxTicks?: number,
  targetKillRatio?: number
): number {
  const killCycle = computeKillCycleTicks(dtMs)
  const budgetTicks = maxTicks ?? elapsedTicks
  const rawBudget = Math.floor(budgetTicks / killCycle)
  const ratio = targetKillRatio ?? 1.0
  const scaledBudget = ratio < 1.0 ? Math.floor(rawBudget * ratio) : rawBudget
  return Math.max(1, Math.min(scaledBudget, uniqueRocksSeen))
}

export interface FitnessBreakdown {
  fitness: number
  perfScore: number
  rocksNorm: number
  accuracyNorm: number
  survivalGate: number
  effectiveMaxRocks: number
  rocksDestroyed: number
  accuracy: number
  uniqueRocksSeen: number
  possibleDeaths: number
  deaths: number
  elapsedTicks: number
}

/**
 * Compute the full fitness breakdown for a single episode, returning all
 * intermediate values alongside the final fitness scalar.
 */
export function computeFitnessBreakdown(
  metrics: RawMetrics,
  weights: FitnessWeights,
  gateConfig: GateConfig,
  context: FitnessContext
): FitnessBreakdown {
  const possibleDeaths = context.possibleDeaths ?? PLAYER_STARTING_LIVES + 1
  const dtMs =
    context.dtMs ?? DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation.dtMs

  const targetAccuracy =
    weights.targetAccuracy > 0 ? weights.targetAccuracy : 0.2
  const effectiveMaxRocks = computePossibleKills(
    metrics.elapsedTicks,
    dtMs,
    metrics.uniqueRocksSeen,
    context.maxTicks,
    weights.targetKillRatio
  )
  const rocksNorm = clamp(metrics.rocksDestroyed / effectiveMaxRocks, 0, 1)
  const accuracyNorm = clamp(metrics.accuracy / targetAccuracy, 0, 1)
  const survivalRaw =
    possibleDeaths > 0 ? clamp(1 - metrics.deaths / possibleDeaths, 0, 1) : 1
  const survivalGate = Math.max(survivalRaw, gateConfig.survivalGateFloor)

  const perfScore =
    weights.rocksDestroyed * rocksNorm + weights.accuracy * accuracyNorm
  const fitness = clamp(perfScore * survivalGate, 0, 1)

  return {
    fitness,
    perfScore,
    rocksNorm,
    accuracyNorm,
    survivalGate,
    effectiveMaxRocks,
    rocksDestroyed: metrics.rocksDestroyed,
    accuracy: metrics.accuracy,
    uniqueRocksSeen: metrics.uniqueRocksSeen,
    possibleDeaths,
    deaths: metrics.deaths,
    elapsedTicks: metrics.elapsedTicks,
  }
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
  return computeFitnessBreakdown(metrics, weights, gateConfig, context).fitness
}

export interface GateBreakdown {
  thrust: number
  fire: number
  turn: number
  turnBias: number
  combined: number
}

/**
 * Compute the full gate breakdown for aggregated frame counts, returning
 * individual per-action gate values and their geometric mean.
 */
export function computeGateBreakdown(
  aggregatedMetrics: ActionFrames,
  config: BehavioralGateConfig = DEFAULT_BEHAVIORAL_GATE_CONFIG
): GateBreakdown {
  const thrust = perActionGate(
    aggregatedMetrics.thrustFrames,
    aggregatedMetrics.aliveFrames,
    config.thrust
  )
  const fire = perActionGate(
    aggregatedMetrics.fireFrames,
    aggregatedMetrics.aliveFrames,
    config.fire
  )
  const turnFrames =
    aggregatedMetrics.leftFrames + aggregatedMetrics.rightFrames
  const turn = perActionGate(
    turnFrames,
    aggregatedMetrics.aliveFrames,
    config.turn
  )
  const bias = perTurnBiasGate(aggregatedMetrics, config.turnBias)
  const combined = Math.max((thrust * fire * turn * bias) ** 0.25, config.floor)
  return { thrust, fire, turn, turnBias: bias, combined }
}

/**
 * Apply behavioral gates on aggregated frame counts across all episodes.
 *
 * Multiplies fitness by the geometric mean of per-action gates computed from
 * total frame counts. This catches agents that consistently exhibit degenerate
 * patterns (e.g. 0% thrust, 100% fire, all-left spinning) without penalizing
 * legitimate focused behavior in short individual scenarios.
 */
export function applyBehavioralGates(
  fitness: number,
  aggregatedMetrics: ActionFrames,
  config: BehavioralGateConfig = DEFAULT_BEHAVIORAL_GATE_CONFIG
): number {
  return clamp(
    fitness * computeGateBreakdown(aggregatedMetrics, config).combined,
    0,
    1
  )
}

export interface GauntletBreakdown {
  /** Final gated fitness (same as evaluate() return). */
  fitness: number
  /** Blended fitness before aggregated behavioral gates. */
  blendedFitnessRaw: number
  /** Weighted scenario component. */
  scenarioFitness: number
  /** Weighted full-game component. */
  fullGameFitness: number
  /** Weighted curriculum component. */
  curriculumFitness: number
  /** Behavioral gate breakdown. */
  gates: GateBreakdown
  /** Per-episode breakdowns for scenarios. */
  scenarioBreakdowns: FitnessBreakdown[]
  /** Per-episode breakdowns for full games. */
  fullGameBreakdowns: FitnessBreakdown[]
  /** Per-episode breakdowns for curriculum. */
  curriculumBreakdowns: FitnessBreakdown[]
  /** Params that generated each curriculum scenario (parallel to curriculumBreakdowns). */
  curriculumParams?: CurriculumScenarioParams[]
  /** Aggregated action frames across all episodes. */
  aggregatedFrames: ActionFrames
  /** Structured RL reward totals across the full gauntlet. */
  rewardBreakdown: RewardBreakdown
  /** Structured RL reward totals split by evaluation mode. */
  rewardBreakdownByMode: RewardBreakdownByMode
  /** Total RL reward accumulated across all episodes in the gauntlet. */
  totalReward: number
}

export interface RewardBreakdown {
  survival: number
  thrust: number
  engagement: number
  progress: number
  kill: number
  score: number
  aim: number
  shotPenalty: number
  death: number
  waveBonus: number
  actionBand: number
  total: number
}

export interface RewardBreakdownByMode {
  scenarios: RewardBreakdown
  fullGame: RewardBreakdown
  curriculum: RewardBreakdown
  total: RewardBreakdown
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
