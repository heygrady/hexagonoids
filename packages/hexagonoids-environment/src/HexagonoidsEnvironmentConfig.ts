import type { ScenarioSnapshot } from './scenarios/types.js'

export interface SimulationConfig {
  maxTicks: number
  dtMs: number
  useFastThrust: boolean
  scenariosPerOrganism: number
  scenarioMaxTicks: number
}

export interface ProfilingConfig {
  enabled: boolean
  sampleEveryNGames: number
  outputPath?: string | undefined
}

export interface FitnessWeights {
  scoreEfficiency: number
  livesRemaining: number
  rocksDestroyed: number
  cellsVisited: number
}

export interface GateConfig {
  /** Minimum gate output (prevents zero-fitness collapse). */
  floor: number
  /** Action saturation low threshold (fraction of aliveFrames). */
  actionLow: number
  /** Action saturation high threshold (fraction of aliveFrames). */
  actionHigh: number
  /** Steepness of the saturation penalty curve. */
  actionSteepness: number
  /** Target number of unique cells for full coverage score. */
  cellsCoverageTarget: number
  /** Scale for death penalty: exp(-deaths / deathScale). Higher = more lenient. */
  deathScale: number
}

export interface HexagonoidsEnvironmentConfig {
  simulation: SimulationConfig
  fitnessWeights: FitnessWeights
  gateConfig: GateConfig
  profiling: ProfilingConfig
  scenarioBank?: ScenarioSnapshot[] | undefined
}

export const DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG: HexagonoidsEnvironmentConfig =
  {
    simulation: {
      maxTicks: 3000,
      dtMs: 33,
      useFastThrust: true,
      scenariosPerOrganism: 20,
      scenarioMaxTicks: 120,
    },
    fitnessWeights: {
      scoreEfficiency: 0.35,
      livesRemaining: 0.2,
      rocksDestroyed: 0.3,
      cellsVisited: 0.15,
    },
    gateConfig: {
      floor: 0.5,
      actionLow: 0.05,
      actionHigh: 0.65,
      actionSteepness: 8,
      cellsCoverageTarget: 40,
      deathScale: 5,
    },
    profiling: {
      enabled: false,
      sampleEveryNGames: 1,
      outputPath: undefined,
    },
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
      profiling: {
        ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.profiling,
      },
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
    profiling: {
      ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.profiling,
      ...partial.profiling,
    },
    ...(partial.scenarioBank != null && {
      scenarioBank: partial.scenarioBank,
    }),
  }
}
