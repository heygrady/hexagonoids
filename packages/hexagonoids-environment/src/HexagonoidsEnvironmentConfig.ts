import {
  DEFAULT_ENCODING_PRESET,
  type EncodingPreset,
} from './encoding/encodingPresets.js'
import type { ScenarioSnapshot } from './scenarios/types.js'

export interface SimulationConfig {
  maxTicks: number
  dtMs: number
  useFastThrust: boolean
  scenariosPerOrganism: number
  scenarioMaxTicks: number
}

export interface FitnessWeights {
  /** Weight for rock destruction progress (w1). */
  rocksDestroyed: number
  /** Weight for shooting accuracy (w2). */
  accuracy: number
  /** Weight for survival / death avoidance (w3). */
  survival: number
}

export interface GateConfig {
  /** Minimum action gate output (prevents zero-fitness collapse). */
  floor: number
  /** Action saturation low threshold (fraction of aliveFrames). */
  actionLow: number
  /** Action saturation high threshold (fraction of aliveFrames). */
  actionHigh: number
  /** Steepness of the saturation penalty curve. */
  actionSteepness: number
  /** Minimum turn gate output. */
  turnFloor: number
  /** Turn saturation low threshold (fraction of aliveFrames). */
  turnLow: number
  /** Turn saturation high threshold (fraction of aliveFrames). */
  turnHigh: number
  /** Steepness of the turn saturation penalty curve. */
  turnSteepness: number
}

export interface HexagonoidsEnvironmentConfig {
  encodingPreset: EncodingPreset
  simulation: SimulationConfig
  fitnessWeights: FitnessWeights
  gateConfig: GateConfig
  scenarioBank?: ScenarioSnapshot[] | undefined
  scenarioWeight: number
  scenarioSeedsPerOrganism: number
  fullGameSeedsPerOrganism: number
}

export const DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG: HexagonoidsEnvironmentConfig =
  {
    encodingPreset: DEFAULT_ENCODING_PRESET,
    simulation: {
      maxTicks: 3000,
      dtMs: 33,
      useFastThrust: true,
      scenariosPerOrganism: 20,
      scenarioMaxTicks: 120,
    },
    fitnessWeights: {
      rocksDestroyed: 0.4,
      accuracy: 0.4,
      survival: 0.2,
    },
    gateConfig: {
      floor: 0.5,
      actionLow: 0.1,
      actionHigh: 0.5,
      actionSteepness: 8,
      turnFloor: 0.1,
      turnLow: 0.1,
      turnHigh: 0.65,
      turnSteepness: 7,
    },
    scenarioWeight: 1.0,
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
      encodingPreset: DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.encodingPreset,
      scenarioWeight: DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.scenarioWeight,
      scenarioSeedsPerOrganism:
        DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.scenarioSeedsPerOrganism,
      fullGameSeedsPerOrganism:
        DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fullGameSeedsPerOrganism,
    }
  }

  return {
    encodingPreset:
      partial.encodingPreset ??
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.encodingPreset,
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
    scenarioSeedsPerOrganism:
      partial.scenarioSeedsPerOrganism ??
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.scenarioSeedsPerOrganism,
    fullGameSeedsPerOrganism:
      partial.fullGameSeedsPerOrganism ??
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fullGameSeedsPerOrganism,
  }
}
