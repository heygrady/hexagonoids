import { threadRNG } from '@neat-evolution/utils'

import {
  getForkingCandidateMoves,
  getValidMoves,
  type Board,
  type Player,
} from '../board/ticTacToe.js'

import type { PlayerMove, PlayerOptions } from './types.js'

/**
 * An advanced "heuristic" AI that serves as a smart-but-flawed sparring partner.
 * It understands forks but can be made to blunder with probabilistic logic.
 *
 * This is a "better teacher" than the simpleAI, as it forces the NEAT
 * agent to learn how to counter and create complex threats.
 * @param {Board} board - The current board state
 * @param {Player} player - The current player
 * @param {PlayerOptions} [options] - Optional configuration
 * @returns {PlayerMove} The new board state and chosen move index
 */
export function heuristicAI(
  board: Board,
  player: Player,
  options?: PlayerOptions | undefined
): PlayerMove {
  const { rng = threadRNG(), verbose } = options ?? {}
  const validMoves = getValidMoves(board)
  if (validMoves.length === 0) {
    throw new Error('No valid moves available (Heuristic)')
  }

  let move: number

  // 1. EMPTY BOARD: Strong, deterministic opening
  if (validMoves.length === 9) {
    const corners = [0, 2, 4, 6, 8] // also center
    move = corners[rng.genRange(0, corners.length)] as number
    if (verbose === true) console.log(`Corner opening ${move + 1}`)
  } else {
    const candidates = getForkingCandidateMoves(board, player)

    // PRIORITY 1: WIN (always)
    if (candidates.winningMoves.length > 0) {
      // Deterministic: always pick first winning move
      move = candidates.winningMoves[
        rng.genRange(0, candidates.winningMoves.length)
      ] as number
      if (verbose === true) console.log(`(H) Winning move ${move + 1}`)

      // PRIORITY 2: BLOCK WIN (always)
    } else if (candidates.blockingMoves.length > 0) {
      move = candidates.blockingMoves[
        rng.genRange(0, candidates.blockingMoves.length)
      ] as number
      if (verbose === true) console.log(`(H) Blocking move ${move + 1}`)

      // PRIORITY 3: CREATE FORK (always)
    } else if (candidates.forkingMoves.length > 0) {
      move = candidates.forkingMoves[
        rng.genRange(0, candidates.forkingMoves.length)
      ] as number
      if (verbose === true) console.log(`(H) Forking move ${move + 1}`)

      // PRIORITY 4: BLOCK FORK (always)
    } else if (candidates.blockingForkMoves.length > 0) {
      move = candidates.blockingForkMoves[
        rng.genRange(0, candidates.blockingForkMoves.length)
      ] as number
      if (verbose === true) console.log(`(H) Blocking fork ${move + 1}`)

      // PRIORITY 5: TAKE CENTER
    } else if (board[4] === 0) {
      move = 4
      if (verbose === true) console.log(`(H) Center move ${move + 1}`)

      // PRIORITY 6: CORNERS (stronger positional play)
    } else {
      const corners = [0, 2, 6, 8].filter((i) => board[i] === 0)
      if (corners.length > 0) {
        move = corners[rng.genRange(0, corners.length)] as number
        if (verbose === true) console.log(`(H) Corner move ${move + 1}`)
      } else {
        // Combine all developing moves (rows, columns, diagonals)
        const allDeveloping = [
          ...candidates.developingRows,
          ...candidates.developingColumns,
          ...candidates.developingDiagonals,
        ]
        if (allDeveloping.length > 0) {
          move = allDeveloping[rng.genRange(0, allDeveloping.length)] as number
          if (verbose === true) console.log(`(H) Developing move ${move + 1}`)
        } else {
          move = validMoves[rng.genRange(0, validMoves.length)] as number
          if (verbose === true) console.log(`(H) Fallback move ${move + 1}`)
        }
      }
    }
  }

  const nextBoard: Board = [...board]
  nextBoard[move] = player

  return [nextBoard, move, 1]
}
