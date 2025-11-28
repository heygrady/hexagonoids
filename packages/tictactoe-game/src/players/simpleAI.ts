import { threadRNG } from '@neat-evolution/utils'

import {
  getCandidateMoves,
  getValidMoves,
  type Board,
  type Player,
} from '../board/ticTacToe.js'

import type { PlayerMove, PlayerOptions } from './types.js'

/**
 * A simple AI that uses basic positional tactics with line-type priorities.
 * Strategy: win → block → rows → columns → diagonals → open → random
 * This makes it stronger than the old version by preferring rows over columns/diagonals.
 * @param {Board} board - The current board state
 * @param {Player} player - The current player
 * @param {PlayerOptions} [options] - Optional configuration
 * @returns {PlayerMove} The new board state and chosen move index
 */
export function simpleAI(
  board: Board,
  player: Player,
  options?: PlayerOptions | undefined
): PlayerMove {
  const { rng = threadRNG(), verbose } = options ?? {}
  const validMoves = getValidMoves(board)
  if (validMoves.length === 0) {
    throw new Error('No valid moves available (Simple)')
  }

  let move: number

  // PRIORITY 0: Empty board opening (edges - intentionally weak)
  if (validMoves.length === 9) {
    // Always edge (deterministic weak opening)
    move = [1, 3, 4, 5, 7][rng.genRange(0, 5)] as number
    if (verbose === true) {
      console.log(`Edge opening ${move + 1}`)
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
    } else if (candidates.blockingMoves.length > 0) {
      move = candidates.blockingMoves[
        rng.genRange(0, candidates.blockingMoves.length)
      ] as number
      if (verbose === true) console.log(`Blocking move ${move + 1}`)

      // PRIORITY 3: BUILD VERTICAL COLUMNS (secondary preference)
    } else if (candidates.developingColumns.length > 0) {
      move = candidates.developingColumns[
        rng.genRange(0, candidates.developingColumns.length)
      ] as number
      if (verbose === true) console.log(`Building column ${move + 1}`)

      // PRIORITY 4: BUILD HORIZONTAL ROWS (most visible/natural)
    } else if (candidates.developingRows.length > 0) {
      move = candidates.developingRows[
        rng.genRange(0, candidates.developingRows.length)
      ] as number
      if (verbose === true) console.log(`Building row ${move + 1}`)

      // PRIORITY 5: BUILD DIAGONALS (lowest developing priority)
    } else if (candidates.developingDiagonals.length > 0) {
      move = candidates.developingDiagonals[
        rng.genRange(0, candidates.developingDiagonals.length)
      ] as number
      if (verbose === true) console.log(`Building diagonal ${move + 1}`)

      // PRIORITY 6: OPEN MOVES (take any open line)
    } else if (candidates.openMoves.length > 0) {
      move = candidates.openMoves[
        rng.genRange(0, candidates.openMoves.length)
      ] as number
      if (verbose === true) console.log(`Open move ${move + 1}`)

      // PRIORITY 7: FALLBACK (any valid move - should rarely happen)
    } else {
      move = validMoves[rng.genRange(0, validMoves.length)] as number
      if (verbose === true) console.log(`Fallback move ${move + 1}`)
    }
  }

  const nextBoard: Board = [...board]
  nextBoard[move] = player

  return [nextBoard, move, 1]
}
