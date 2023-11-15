import type { EnvironmentDescription } from '@neat-evolution/environment'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'

import type { GameData } from './GameData.js'

export type GameFn<P extends SyncExecutor[], GD extends GameData> = (
  players: P
) => GD

export type AsyncGameFn<PA extends Executor[], GD extends GameData> = (
  players: PA
) => Promise<GD>

export interface GameExecutor<
  GO,
  P extends SyncExecutor[],
  PA extends Executor[],
  GD extends GameData,
> {
  options: GO
  pathname: string
  description: EnvironmentDescription
  playerSize: number
  minScore: number
  maxScore: number
  isAsync: boolean
  play: GameFn<P, GD>
  playAsync: AsyncGameFn<PA, GD>
}

export const isAsyncGameExecutor = (
  gameExecutor: GameExecutor<any, any, any, any>
): gameExecutor is GameExecutor<any, any, any, any> & { isAsync: true } => {
  return gameExecutor.isAsync
}
