import type { EnvironmentFactory } from '@neat-evolution/environment'

import { createSimulationProfiler } from './evaluation/nodePerfProfiler.js'
import { HexagonoidsEnvironment } from './HexagonoidsEnvironment.js'
import type { HexagonoidsEnvironmentConfig } from './HexagonoidsEnvironmentConfig.js'
import { mergeConfig } from './HexagonoidsEnvironmentConfig.js'

export const createEnvironment: EnvironmentFactory<
  Partial<HexagonoidsEnvironmentConfig> | undefined
> = (options) => {
  const config = mergeConfig(options)
  const profiler = createSimulationProfiler(config.profiling)
  return new HexagonoidsEnvironment(options, profiler)
}
