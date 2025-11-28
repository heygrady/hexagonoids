import { threadRNG } from '@neat-evolution/utils'

import {
  getCandidateMoves,
  getValidMoves,
  type Board,
  type Player,
} from '../board/ticTacToe.js'

import type { PlayerMove, PlayerOptions } from './types.js'

/**
 * Totally random AI player.
 * @param {Board} board - The current board state
 * @param {Player} player - The current player
 * @param {PlayerOptions} [options] - Optional configuration
 * @returns {PlayerMove} The new board state and chosen move index
 */
export function randomAI(
  board: Board,
  player: Player,
  options?: PlayerOptions | undefined
): PlayerMove {
  const { rng = threadRNG(), verbose } = options ?? {}
  const validMoves = getValidMoves(board)
  if (validMoves.length === 0) {
    throw new Error('No valid moves available (Random)')
  }
  let move: number
  if (validMoves.length === 9) {
    move = rng.genBool() ? 1 : 4 // choose center or middle
    if (verbose === true) {
      console.log(`Random opening ${move + 1}`)
    }
  } else {
    const candidates = getCandidateMoves(board, player)

    // PRIORITY 1: WIN (always take it)
    if (candidates.winningMoves.length > 0) {
      move = candidates.winningMoves[
        rng.genRange(0, candidates.winningMoves.length)
      ] as number
      if (verbose === true) console.log(`Winning move ${move + 1}`)

      // PRIORITY 2: BLOCK (always block opponent's win)
    } else if (candidates.blockingMoves.length > 0 && rng.genBool()) {
      move = candidates.blockingMoves[
        rng.genRange(0, candidates.blockingMoves.length)
      ] as number
      if (verbose === true) console.log(`Blocking move ${move + 1}`)

      // PRIORITY 3: RANDOM MOVE
    } else {
      move = validMoves[rng.genRange(0, validMoves.length)] as number
      if (verbose === true) console.log(`Random move ${move + 1}`)
    }
  }

  const nextBoard: Board = [...board]
  nextBoard[move] = player

  return [nextBoard, move, 1]
}
