import type { ScenarioSnapshot } from './scenarios/types.js'

export interface SimulationConfig {
  maxTicks: number
  dtMs: number
  useFastThrust: boolean
  scenariosPerOrganism: number
  scenarioMaxTicks: number
  /** Whether to run curriculum micro-scenarios during evaluation. */
  curriculumEnabled: boolean
  /** Number of curriculum micro-scenarios to run (default 32 = 8 cones x 4 variants). */
  curriculumCount: number
  /** Max yaw offset in radians for scenario ship jitter (default: 0 = disabled). */
  scenarioJitterYaw?: number
  /** Max speed scale fraction for scenario ship jitter (default: 0 = disabled). */
  scenarioJitterSpeed?: number
}

export interface FitnessWeights {
  /** Weight for rock destruction progress (w1). */
  rocksDestroyed: number
  /** Weight for shooting accuracy (w2). */
  accuracy: number
  /** Accuracy threshold at which the accuracy term saturates to 1.0 (default 0.2 = 1-in-5 hit rate). */
  targetAccuracy: number
}

/**
 * Named easing curves for gate penalty falloff.
 *
 * The sweet zone between `low` and `high` stays at score=1. Both sides taper:
 * - **Low side** (fraction 0→low): `easeOut(t)` — fast rise near 0, gradual approach to 1
 * - **High side** (fraction high→1): `1 - easeIn(t)` — gentle departure from 1, steep drop
 */
export type GateEasing = 'linear' | 'quad' | 'cubic' | 'exp' | 'circle'

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
  scenarioBank?: ScenarioSnapshot[] | undefined
  /** Blending weight for scenario fitness. Normalized with fullGameWeight and curriculumWeight. */
  scenarioWeight: number
  /** Blending weight for full-game fitness. Normalized with scenarioWeight and curriculumWeight. */
  fullGameWeight: number
  /** Blending weight for curriculum fitness. Normalized with scenarioWeight and fullGameWeight. */
  curriculumWeight: number
  scenarioSeedsPerOrganism: number
  fullGameSeedsPerOrganism: number
}

export const DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG: HexagonoidsEnvironmentConfig =
  {
    simulation: {
      maxTicks: 3000,
      dtMs: 33,
      useFastThrust: true,
      scenariosPerOrganism: 20,
      scenarioMaxTicks: 120,
      curriculumEnabled: false,
      curriculumCount: 32,
    },
    fitnessWeights: {
      rocksDestroyed: 0.7,
      accuracy: 0.3,
      targetAccuracy: 0.3,
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
  }
}
