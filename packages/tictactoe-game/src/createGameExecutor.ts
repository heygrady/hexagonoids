import { type GameExecutor, type PlayerData } from '@heygrady/game-environment'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'

import { ObjectPool } from './ObjectPool.js'
import { TicTacToeGame, WIN_VALUE } from './TicTacToeGame.js'
import type { TicTacToeGameOptions } from './TicTacToeGameOptions.js'

export type TicTacToeGameData = [
  player1Data: PlayerData,
  player2Data: PlayerData,
]

const combineGameData = (
  gameData1: TicTacToeGameData,
  gameData2: TicTacToeGameData
): TicTacToeGameData => {
  // combine the results
  return [
    [gameData1[0][0], gameData1[0][1] + gameData2[1][1]] as PlayerData,
    [gameData1[1][0], gameData1[1][1] + gameData2[0][1]] as PlayerData,
  ] as TicTacToeGameData
}

export interface GamePoolFactoryOptions {
  executor1: Executor
  executor2: Executor
  options: TicTacToeGameOptions
}
const gamePool = new ObjectPool<TicTacToeGame, GamePoolFactoryOptions>(
  ({ executor1, executor2, options }) =>
    new TicTacToeGame(executor1, executor2, options)
)

export const createGameExecutor = (
  options: TicTacToeGameOptions
): GameExecutor<
  TicTacToeGameOptions,
  [executor1: SyncExecutor, executor2: SyncExecutor],
  [executor1: Executor, executor2: Executor],
  TicTacToeGameData
> => {
  const maxBonus = 160 // 142 observed on a 5x5 board
  const maxScore = (maxBonus + WIN_VALUE) * 2 // they play two games

  return {
    options,
    pathname: '@heygrady/tictactoe-game',
    description: {
      inputs: options.boardSize * options.boardSize * 3,
      outputs: options.boardSize * options.boardSize,
    },
    playerSize: 2,
    minScore: 0,
    maxScore,
    isAsync: false,

    play: (
      players: [executor1: SyncExecutor, executor2: SyncExecutor]
    ): TicTacToeGameData => {
      const [executor1, executor2] = players
      // play both ways
      const game1 = gamePool.acquire({ executor1, executor2, options })
      const game2 = gamePool.acquire({
        executor1: executor2,
        executor2: executor1,
        options,
      })
      const result = combineGameData(game1.play(), game2.play())
      gamePool.release(game1)
      gamePool.release(game2)
      return result
    },

    playAsync: async (
      players: [executor1: Executor, executor2: Executor]
    ): Promise<TicTacToeGameData> => {
      const [executor1, executor2] = players
      // play both ways
      const game1 = gamePool.acquire({ executor1, executor2, options })
      const game2 = gamePool.acquire({
        executor1: executor2,
        executor2: executor1,
        options,
      })
      const result = combineGameData(
        await game1.playAsync(),
        await game2.playAsync()
      )
      gamePool.release(game1)
      gamePool.release(game2)
      return result
    },
  }
}
