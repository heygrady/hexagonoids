import type { EnvironmentFactory } from '@neat-evolution/environment'

import { TicTacToeEnvironment } from './TicTacToeEnvironment.js'
import type { TicTacToeEnvironmentConfig } from './TicTacToeEnvironmentConfig.js'

export const createEnvironment: EnvironmentFactory<
  Partial<TicTacToeEnvironmentConfig> | undefined
> = (options) => {
  return new TicTacToeEnvironment(options)
}
