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
  score: number
  livesRemaining: number
  accuracy: number
  distanceTraveled: number
  rocksDestroyed: number
  timeAlive: number
}

export interface HexagonoidsEnvironmentConfig {
  simulation: SimulationConfig
  fitnessWeights: FitnessWeights
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
      score: 0.3,
      livesRemaining: 0.2,
      accuracy: 0.15,
      distanceTraveled: 0.15,
      rocksDestroyed: 0.1,
      timeAlive: 0.1,
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
    profiling: {
      ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.profiling,
      ...partial.profiling,
    },
  }
}
