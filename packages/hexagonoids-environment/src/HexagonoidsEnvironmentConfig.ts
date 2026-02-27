export interface SimulationConfig {
  maxTicks: number
  dtMs: number
  useFastThrust: boolean
}

export interface ProfilingConfig {
  enabled: boolean
  sampleEveryNGames: number
  outputPath?: string | undefined
}

export interface FitnessWeights {
  scoreEfficiency: number
  livesRemaining: number
  accuracy: number
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
}

export interface HexagonoidsEnvironmentConfig {
  simulation: SimulationConfig
  fitnessWeights: FitnessWeights
  gateConfig: GateConfig
  profiling: ProfilingConfig
}

export const DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG: HexagonoidsEnvironmentConfig =
  {
    simulation: {
      maxTicks: 3000,
      dtMs: 33,
      useFastThrust: true,
    },
    fitnessWeights: {
      scoreEfficiency: 0.3,
      livesRemaining: 0.2,
      accuracy: 0.2,
      rocksDestroyed: 0.2,
      cellsVisited: 0.1,
    },
    gateConfig: {
      floor: 0.1,
      actionLow: 0.05,
      actionHigh: 0.85,
      actionSteepness: 8,
      cellsCoverageTarget: 40,
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
  }
}
