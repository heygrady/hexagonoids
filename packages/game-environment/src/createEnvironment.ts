import type { Executor, SyncExecutor } from '@neat-evolution/executor'

import type { GameData } from './GameData.js'
import { GameEnvironment } from './GameEnvironment.js'
import type { GameEnvironmentOptions } from './GameEnvironmentOptions.js'

export type PlayerFactory<P> = (executor: SyncExecutor) => P

export const createEnvironment = <
  E extends SyncExecutor[],
  EA extends Executor[],
  GD extends GameData,
>(
  options: GameEnvironmentOptions
) => {
  const environment = new GameEnvironment<E, EA, GD>(options)
  return environment
}
