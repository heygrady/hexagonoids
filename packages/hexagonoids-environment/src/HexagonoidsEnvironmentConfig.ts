import type { RewardConfig } from './evaluation/simulateGame.js'
import type { RuntimeScoringHooksConfig } from './runtimeHooksTypes.js'
import type { ScenarioSnapshot } from './scenarios/types.js'

export interface SimulationConfig {
  maxTicks: number
  dtMs: number
  useFastThrust: boolean
  scenariosPerOrganism: number
  scenarioMaxTicks: number
  /** Number of curriculum micro-scenarios to run (default 48). */
  curriculumCount: number
  /** Max yaw offset in radians for scenario ship jitter. Default ~15° so agents can't memorize one aim direction. */
  scenarioJitterYaw?: number
  /** Max speed scale fraction for scenario ship jitter. Default 0.2 = ±20% speed variation. */
  scenarioJitterSpeed?: number
}

export interface FitnessWeights {
  /** Weight for rock destruction progress (w1). */
  rocksDestroyed: number
  /** Weight for shooting accuracy (w2). */
  accuracy: number
  /** Accuracy threshold at which the accuracy term saturates to 1.0 (default 0.2 = 1-in-5 hit rate). */
  targetAccuracy: number
  /**
   * Fraction of the physics-based kill budget that counts as "perfect".
   * The kill budget is computed from the configured episode maxTicks (not
   * actual elapsed time), so surviving longer does not inflate the target.
   * Default 0.5 means killing half the theoretical max = rocksNorm 1.0.
   */
  targetKillRatio: number
}

/**
 * Named easing curves for gate penalty falloff.
 *
 * The sweet zone between `low` and `high` stays at score=1. Both sides taper:
 * - **Low side** (fraction 0→low): `easeOut(t)` — fast rise near 0, gradual approach to 1
 * - **High side** (fraction high→1): `1 - easeIn(t)` — gentle departure from 1, steep drop
 */
export type GateEasing = 'linear' | 'quad' | 'cubic' | 'exp' | 'circle'

/** Per-action saturation gate config. */
export interface ActionGateConfig {
  /** Below this usage fraction → penalty (not enough). */
  low: number
  /** Above this usage fraction → penalty (too much). */
  high: number
  /** Easing curve for penalty falloff. */
  easing: GateEasing
  /** Per-action minimum gate output. */
  floor: number
}

/** Turn bias gate config. */
export interface TurnBiasGateConfig {
  /** Bias threshold above which penalty kicks in (0.5=balanced, 1.0=all one direction). */
  max: number
  /** Easing curve for penalty. */
  easing: GateEasing
  /** Minimum gate output. */
  floor: number
}

/**
 * Non-overlapping per-action behavioral gate config.
 * Each action is counted exactly once. Combined via geometric mean.
 */
export interface BehavioralGateConfig {
  thrust: ActionGateConfig
  fire: ActionGateConfig
  turn: ActionGateConfig
  turnBias: TurnBiasGateConfig
  /** Combined gate floor (minimum output of the geometric mean). */
  floor: number
}

export const DEFAULT_BEHAVIORAL_GATE_CONFIG: BehavioralGateConfig = {
  thrust: { low: 0.15, high: 0.85, easing: 'exp', floor: 0.3 },
  fire: { low: 0.05, high: 0.6, easing: 'exp', floor: 0.3 },
  turn: { low: 0.15, high: 0.9, easing: 'exp', floor: 0.1 },
  turnBias: { max: 0.85, easing: 'cubic', floor: 0.1 },
  floor: 0.05,
}

/** @deprecated Use BehavioralGateConfig instead. Kept for survivalGateFloor. */
export interface GateConfig {
  /** Minimum action diversity gate output (prevents zero-fitness collapse). */
  actionGateFloor: number
  /** Action saturation low threshold (fraction of aliveFrames). */
  actionLow: number
  /** Action saturation high threshold (fraction of aliveFrames). */
  actionHigh: number
  /** Easing curve for action saturation penalty falloff. */
  actionEasing: GateEasing
  /** Minimum turn gate output. */
  turnGateFloor: number
  /** Turn saturation low threshold (fraction of aliveFrames). */
  turnLow: number
  /** Turn saturation high threshold (fraction of aliveFrames). */
  turnHigh: number
  /** Easing curve for turn saturation penalty falloff. */
  turnEasing: GateEasing
  /** Minimum throttle gate output. */
  throttleGateFloor: number
  /** Throttle saturation low threshold (fraction of aliveFrames). */
  throttleLow: number
  /** Throttle saturation high threshold (fraction of aliveFrames). */
  throttleHigh: number
  /** Easing curve for throttle saturation penalty falloff. */
  throttleEasing: GateEasing
  /** Minimum turn bias gate output. */
  turnBiasGateFloor: number
  /** Bias threshold (0.5=balanced, 1.0=all one direction) above which penalty kicks in. */
  turnBiasMax: number
  /** Easing curve for turn bias penalty. */
  turnBiasEasing: GateEasing
  /** Minimum survival gate output. */
  survivalGateFloor: number
}

export interface HexagonoidsEnvironmentConfig {
  simulation: SimulationConfig
  fitnessWeights: FitnessWeights
  gateConfig: GateConfig
  behavioralGateConfig?: BehavioralGateConfig
  scenarioBank?: ScenarioSnapshot[] | undefined
  /** Blending weight for scenario fitness. Normalized with fullGameWeight and curriculumWeight. */
  scenarioWeight: number
  /** Blending weight for full-game fitness. Normalized with scenarioWeight and curriculumWeight. */
  fullGameWeight: number
  /** Blending weight for curriculum fitness. Normalized with scenarioWeight and fullGameWeight. */
  curriculumWeight: number
  scenarioSeedsPerOrganism: number
  fullGameSeedsPerOrganism: number
  /** Per-tick reward config for RL step agents. Falls back to DEFAULT_REWARD_CONFIG when omitted. */
  rewardConfig?: Partial<RewardConfig> | undefined
  /** Worker-safe runtime scoring rig references. */
  runtimeHooks?: RuntimeScoringHooksConfig | undefined
  /**
   * Total number of genome outputs reported in description.outputs.
   * Defaults to 7: thrust(2), fire(2), turn(3 left/none/right).
   * RL modes may add a critic/value head or use legacy binary layouts.
   * The environment decodes outputs by layout:
   * 7 = grouped categorical action head, 8+ = legacy paired, 4 = legacy binary.
   */
  outputCount?: number | undefined
}

export const DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG: HexagonoidsEnvironmentConfig =
  {
    simulation: {
      maxTicks: 3000,
      dtMs: 33,
      useFastThrust: true,
      scenariosPerOrganism: 20,
      scenarioMaxTicks: 120,
      curriculumCount: 48,
      scenarioJitterYaw: Math.PI / 12, // ~15 degrees
      scenarioJitterSpeed: 0.2, // ±20% speed variation
    },
    fitnessWeights: {
      rocksDestroyed: 0.7,
      accuracy: 0.3,
      targetAccuracy: 0.3,
      targetKillRatio: 0.5,
    },
    gateConfig: {
      actionGateFloor: 0.2,
      actionLow: 0.005,
      actionHigh: 0.65,
      actionEasing: 'exp',
      turnGateFloor: 0.01,
      turnLow: 0.01,
      turnHigh: 0.95,
      turnEasing: 'exp',
      throttleGateFloor: 0.01,
      throttleLow: 0.1,
      throttleHigh: 0.9,
      throttleEasing: 'exp',
      turnBiasGateFloor: 0.01,
      turnBiasMax: 0.99,
      turnBiasEasing: 'cubic',
      survivalGateFloor: 0,
    },
    scenarioWeight: 1.0,
    fullGameWeight: 0,
    curriculumWeight: 0,
    scenarioSeedsPerOrganism: 1,
    fullGameSeedsPerOrganism: 1,
  }

export function mergeConfig(
  partial?: Partial<HexagonoidsEnvironmentConfig>
): HexagonoidsEnvironmentConfig {
  if (partial === undefined) {
    return {
      simulation: { ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation },
      fitnessWeights: {
        ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fitnessWeights,
      },
      gateConfig: {
        ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.gateConfig,
      },
      scenarioWeight: DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.scenarioWeight,
      fullGameWeight: DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fullGameWeight,
      curriculumWeight: DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.curriculumWeight,
      scenarioSeedsPerOrganism:
        DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.scenarioSeedsPerOrganism,
      fullGameSeedsPerOrganism:
        DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fullGameSeedsPerOrganism,
    }
  }

  return {
    simulation: {
      ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation,
      ...partial.simulation,
    },
    fitnessWeights: {
      ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fitnessWeights,
      ...partial.fitnessWeights,
    },
    gateConfig: {
      ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.gateConfig,
      ...partial.gateConfig,
    },
    ...(partial.scenarioBank != null && {
      scenarioBank: partial.scenarioBank,
    }),
    scenarioWeight:
      partial.scenarioWeight ??
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.scenarioWeight,
    fullGameWeight:
      partial.fullGameWeight ??
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fullGameWeight,
    curriculumWeight:
      partial.curriculumWeight ??
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.curriculumWeight,
    scenarioSeedsPerOrganism:
      partial.scenarioSeedsPerOrganism ??
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.scenarioSeedsPerOrganism,
    fullGameSeedsPerOrganism:
      partial.fullGameSeedsPerOrganism ??
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fullGameSeedsPerOrganism,
    ...(partial.rewardConfig != null && { rewardConfig: partial.rewardConfig }),
    ...(partial.runtimeHooks != null && {
      runtimeHooks: {
        ...partial.runtimeHooks,
      },
    }),
    ...(partial.outputCount != null && { outputCount: partial.outputCount }),
    ...(partial.behavioralGateConfig != null && {
      behavioralGateConfig: {
        ...DEFAULT_BEHAVIORAL_GATE_CONFIG,
        ...partial.behavioralGateConfig,
        thrust: {
          ...DEFAULT_BEHAVIORAL_GATE_CONFIG.thrust,
          ...partial.behavioralGateConfig.thrust,
        },
        fire: {
          ...DEFAULT_BEHAVIORAL_GATE_CONFIG.fire,
          ...partial.behavioralGateConfig.fire,
        },
        turn: {
          ...DEFAULT_BEHAVIORAL_GATE_CONFIG.turn,
          ...partial.behavioralGateConfig.turn,
        },
        turnBias: {
          ...DEFAULT_BEHAVIORAL_GATE_CONFIG.turnBias,
          ...partial.behavioralGateConfig.turnBias,
        },
      },
    }),
  }
}
