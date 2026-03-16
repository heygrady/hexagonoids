import type { EnvironmentFactory } from '@neat-evolution/environment'

import { HexagonoidsEnvironment } from './HexagonoidsEnvironment.js'
import type { HexagonoidsEnvironmentConfig } from './HexagonoidsEnvironmentConfig.js'
import { mergeConfig } from './HexagonoidsEnvironmentConfig.js'

export const createEnvironment: EnvironmentFactory<
  Partial<HexagonoidsEnvironmentConfig> | undefined
> = (options, initOptions) => {
  const config = mergeConfig(options)
  return new HexagonoidsEnvironment(config, initOptions)
}
