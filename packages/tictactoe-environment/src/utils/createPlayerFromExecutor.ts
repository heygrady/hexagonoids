import {
  type Board,
  neatAI,
  type Player,
  type PlayerFn,
} from '@heygrady/tictactoe-game'
import type { Executor } from '@neat-evolution/executor'

export function createPlayerFromExecutor(executor: Executor): PlayerFn {
  return (board: Board, player: Player, options?) =>
    neatAI(board, player, { ...options, executor })
}
