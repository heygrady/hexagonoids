import type { SyncExecutor } from '@neat-evolution/executor'
import type { RNG } from '@neat-evolution/utils'

import type { Board, Player } from '../board/ticTacToe.js'

export interface PlayerOptions {
  rng?: RNG | undefined
  verbose?: boolean
  executor?: SyncExecutor
}

export type PlayerMove = [Board, move: number, fitness: number]
export type PlayerFn = (
  board: Board,
  player: Player,
  options?: PlayerOptions | undefined
) => PlayerMove
