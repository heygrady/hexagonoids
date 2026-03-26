import {
  HexagonoidsEnvironment,
  type HexagonoidsEnvironmentConfig,
} from '@heygrady/hexagonoids-environment'
import type { EnvironmentFactory } from '@neat-evolution/environment'

export const createEnvironment: EnvironmentFactory<
  Partial<HexagonoidsEnvironmentConfig> | undefined
> = (options, initOptions) => {
  return new HexagonoidsEnvironment(options, initOptions)
}
