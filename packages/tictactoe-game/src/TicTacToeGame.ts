import type { PlayerData } from '@heygrady/game-environment'
import type { EnvironmentDescription } from '@neat-evolution/environment'
import { isAsyncExecutor, type Executor } from '@neat-evolution/executor'

import type {
  GamePoolFactoryOptions,
  TicTacToeGameData,
} from './createGameExecutor.js'
import {
  createPlayer,
  type AsyncPlayerFn,
  type PlayerFn,
  createAsyncPlayer,
} from './createPlayer.js'
import { scoreMove } from './score/scoreMove.js'
import { TicTacToeBoard, type BoardStatus } from './TicTacToeBoard.js'
import type { TicTacToeGameOptions } from './TicTacToeGameOptions.js'

export const WIN_VALUE = 10
export const DRAW_VALUE = 5
export const LOSE_VALUE = 0

export class TicTacToeGame {
  public description: EnvironmentDescription
  public board: TicTacToeBoard

  public player1: PlayerFn | AsyncPlayerFn | null
  public player2: PlayerFn | AsyncPlayerFn | null
  public executor1: Executor | null
  public executor2: Executor | null

  constructor(
    executor1: Executor,
    executor2: Executor,
    options: TicTacToeGameOptions
  ) {
    if (options.boardSize < 3) {
      throw new Error('Board size must be at least 3')
    }
    this.player1 = null
    this.player2 = null
    this.executor1 = null
    this.executor2 = null

    const spaceCount = options.boardSize * options.boardSize
    this.description = {
      inputs: spaceCount * 3,
      outputs: spaceCount,
    }

    this.board = new TicTacToeBoard(options.boardSize)
    this.initialize({ executor1, executor2, options })
  }

  public reset(): void {
    this.player1 = null
    this.player2 = null
    this.executor1 = null
    this.executor2 = null
    this.board.clear()
  }

  public initialize({
    executor1,
    executor2,
    options,
  }: GamePoolFactoryOptions): void {
    if (options.boardSize < 3) {
      throw new Error('Board size must be at least 3')
    }
    this.player1 = isAsyncExecutor(executor1)
      ? createAsyncPlayer(executor1)
      : createPlayer(executor1)
    this.player2 = isAsyncExecutor(executor1)
      ? createAsyncPlayer(executor1)
      : createPlayer(executor1)
    this.executor1 = executor1
    this.executor2 = executor2

    const spaceCount = options.boardSize * options.boardSize
    this.description = {
      inputs: spaceCount,
      outputs: spaceCount,
    }

    if (options.boardSize === this.board.boardSize) {
      this.board.clear()
    } else {
      this.board = new TicTacToeBoard(options.boardSize)
    }
  }

  play(): TicTacToeGameData {
    if (this.player1 == null || this.player2 == null) {
      throw new Error('Players must be set before playing')
    }
    if (this.executor1 == null || this.executor2 == null) {
      throw new Error('Executors must be set before playing')
    }
    if (isAsyncExecutor(this.executor1) || isAsyncExecutor(this.executor2)) {
      throw new Error('Cannot play sync game with async executors')
    }
    // Initialize with draw score
    const player1Data: PlayerData = [this.executor1, DRAW_VALUE]
    const player2Data: PlayerData = [this.executor2, DRAW_VALUE]
    const gameData: TicTacToeGameData = [player1Data, player2Data]

    let round = 0
    let status: BoardStatus = this.board.getStatus()
    let player1Bonus: number = 0
    let player2Bonus: number = 0
    while (!status.gameOver) {
      const turn = round % 2
      const playerToken = turn === 0 ? 1 : -1
      const player: PlayerFn = (
        turn === 0 ? this.player1 : this.player2
      ) as PlayerFn

      // player token is always 1 from their perspective
      const playerBoard =
        turn === 0 ? this.board.board : this.board.inverseBoard
      const [move, bonus] = player(playerBoard)

      // bonus points for making good moves
      if (turn === 0) {
        player1Bonus += bonus
        if (bonus > 0) {
          player1Bonus += scoreMove(
            this.board.board,
            this.board.boardSize,
            playerToken,
            move
          )
        }
      } else {
        player2Bonus += bonus
        if (bonus > 0) {
          player2Bonus += scoreMove(
            this.board.board,
            this.board.boardSize,
            playerToken,
            move
          )
        }
      }

      this.board.set(move, playerToken)
      status = this.board.getStatus()

      round++
    }
    if (status.player1Wins) {
      player1Data[1] = WIN_VALUE
      player2Data[1] = LOSE_VALUE
    }
    if (status.player2Wins) {
      player1Data[1] = LOSE_VALUE
      player2Data[1] = WIN_VALUE
    }

    // apply bonus points
    if (player1Bonus > 0) {
      player1Data[1] += player1Bonus / round // normalize to avoid favoring long games
    }
    if (player2Bonus > 0) {
      player2Data[1] += player2Bonus / round
    }

    // if (Math.max(player1Data[1], player2Data[1]) > 60) {
    //   console.log(player1Data[1], player2Data[1])
    // }
    return gameData
  }

  async playAsync(): Promise<TicTacToeGameData> {
    // FIXME: implement async play
    throw new Error('Not implemented')
  }
}
