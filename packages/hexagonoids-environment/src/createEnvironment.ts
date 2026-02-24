import type { EnvironmentFactory } from '@neat-evolution/environment'

import { HexagonoidsEnvironment } from './HexagonoidsEnvironment.js'
import type { HexagonoidsEnvironmentConfig } from './HexagonoidsEnvironmentConfig.js'

export const createEnvironment: EnvironmentFactory<
  Partial<HexagonoidsEnvironmentConfig> | undefined
> = (options) => {
  return new HexagonoidsEnvironment(options)
}
