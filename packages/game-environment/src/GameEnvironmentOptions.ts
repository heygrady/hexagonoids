import type { EnvironmentDescription } from '@neat-evolution/environment'

import type { GameExecutor } from './GameExecutor.js'

export interface GameEnvironmentOptions {
  description: EnvironmentDescription
  gameExecutor: GameExecutor<any, any, any, any>
}
