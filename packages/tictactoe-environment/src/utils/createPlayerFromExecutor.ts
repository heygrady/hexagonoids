import {
  neatAI,
  type Board,
  type Player,
  type PlayerFn,
} from '@heygrady/tictactoe-game'
import type { SyncExecutor } from '@neat-evolution/executor'

export function createPlayerFromExecutor(executor: SyncExecutor): PlayerFn {
  return (board: Board, player: Player, options?) =>
    neatAI(board, player, { ...options, executor })
}
