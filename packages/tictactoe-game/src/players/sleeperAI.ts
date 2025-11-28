import { threadRNG } from '@neat-evolution/utils'

import { getValidMoves, type Board, type Player } from '../board/ticTacToe.js'
import { randomAI } from '../index.js'

import { minimaxAI } from './minimaxAI.js'
import type { PlayerMove, PlayerOptions } from './types.js'

/**
 * Totally random AI player.
 * @param {Board} board - The current board state
 * @param {Player} player - The current player
 * @param {PlayerOptions} [options] - Optional configuration
 * @returns {PlayerMove} The new board state and chosen move index
 */
export function sleeperAI(
  board: Board,
  player: Player,
  options?: PlayerOptions | undefined
): PlayerMove {
  const { rng = threadRNG() } = options ?? {}
  const validMoves = getValidMoves(board)
  // first two moves are randomAI, then minimaxAI
  const randomMovesThreshold = 9 - ([3, 4, 5][rng.genRange(0, 3)] ?? 3)
  if (validMoves.length < randomMovesThreshold) {
    return minimaxAI(board, player, options)
  }
  return randomAI(board, player, options)
}
