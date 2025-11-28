import { threadRNG } from '@neat-evolution/utils'
import QuickLRU from 'quick-lru'

import { reorientBoard } from '../board/reorientBoard.js'
import {
  boardToKey,
  checkState,
  getValidMoves,
  type Board,
  type Player,
} from '../board/ticTacToe.js'

import type { PlayerMove, PlayerOptions } from './types.js'
// Re-import reorientBoard for the optimization

// This cache (Transposition Table) is the key to performance.
// It stores the computed score for any given board state.
const minimaxCache = new QuickLRU<number, number>({ maxSize: 50_000 })

/**
 * The recursive heart of the Minimax algorithm.
 * It computes the best possible score from a given board state.
 * @param {Board} board - The *mutable* board state to evaluate.
 * @param {boolean} isMaximizing - Is it the AI's turn (maximize score) or opponent's (minimize score)?
 * @param {Player} aiPlayer - The player we are (e.g., 1)
 * @param {Player} opponent - The opponent player (e.g., -1)
 * @returns {number} The score: 10 for a win, -10 for a loss, 0 for a draw.
 */
function minimaxRecursive(
  board: Board, // This board is the current mutable state
  isMaximizing: boolean,
  aiPlayer: Player,
  opponent: Player
): number {
  // --- 1. Reorient Board to Canonical Form ---
  // This is the key optimization. We get the "normalized" version of the board.
  // We can ignore the transform function, as it's not needed for minimax logic.
  // `canonicalBoard` is a new array (a slice), so it's safe to mutate below.
  const [canonicalBoard] = reorientBoard(board)

  // --- 2. Check Cache ---
  // Use the canonical board's key. This will catch all symmetrical states.
  const key = boardToKey(canonicalBoard) * (isMaximizing ? 1 : -1)
  if (minimaxCache.has(key)) {
    return minimaxCache.get(key) as number
  }

  // --- 3. Check for Terminal State (Win/Loss/Draw) ---
  // We check the state of the *canonical* board.
  const [isWin, isDraw, winner] = checkState(canonicalBoard)

  if (isWin) {
    if (winner === aiPlayer) return 10 // AI wins
    if (winner === opponent) return -10 // Opponent wins
  }
  if (isDraw) {
    return 1 // Draw
  }

  // --- 4. Recursive Step ---
  // Get valid moves for the *canonical* board.
  const validMoves = getValidMoves(canonicalBoard)

  if (isMaximizing) {
    // AI's turn (find the HIGHEST score move)
    let bestScore = -Infinity
    for (const move of validMoves) {
      canonicalBoard[move] = aiPlayer // Make the move (mutate canonical board)
      // The recursive call uses the (now mutated) canonicalBoard.
      // The next call to reorientBoard() will correctly find its
      // *next* canonical state.
      const score = minimaxRecursive(canonicalBoard, false, aiPlayer, opponent)
      canonicalBoard[move] = 0 // Undo the move (revert mutation)
      bestScore = Math.max(bestScore, score)
    }
    minimaxCache.set(key, bestScore)
    return bestScore
  } else {
    // Opponent's turn (find the LOWEST score move)
    let bestScore = Infinity
    for (const move of validMoves) {
      canonicalBoard[move] = opponent // Make the move (mutate canonical board)
      const score = minimaxRecursive(canonicalBoard, true, aiPlayer, opponent)
      canonicalBoard[move] = 0 // Undo the move (revert mutation)
      bestScore = Math.min(bestScore, score)
    }
    minimaxCache.set(key, bestScore)
    return bestScore
  }
}

/**
 * A "perfect" AI that uses the Minimax algorithm to find the
 * guaranteed optimal move.
 * It's "aggressive" because it will always take a win if one is
 * available, and always block if it must.
 * @param {Board} board - The current board state
 * @param {Player} player - The AI player (1 or -1)
 * @param {PlayerOptions} [options] - Optional configuration
 * @returns {PlayerMove} The new board state and chosen move index
 */
export function minimaxAI(
  board: Board,
  player: Player,
  options?: PlayerOptions | undefined
): PlayerMove {
  const { rng = threadRNG(), verbose } = options ?? {}
  const opponent: Player = player === 1 ? -1 : 1
  let bestScore = -Infinity
  let bestMove = -1
  const validMoves = getValidMoves(board)
  let bestMoves: number[] = []

  // --- OPTIMIZATION ---
  // We use a *single* temporary board and "undo" the move
  // in the loop. This avoids N array allocations (where N=validMoves)
  // and is significantly faster for a hot function like this.
  const tempBoard = [...board] as Board

  if (validMoves.length === 9) {
    const corners = [0, 2, 6, 8]
    bestMove = corners[rng.genRange(0, corners.length)] as number
    if (verbose === true) {
      console.log(`MinimaxAI chooses move ${bestMove + 1} (opening move)`)
    }
    const nextBoard: Board = [...board]
    nextBoard[bestMove] = player
    return [nextBoard, bestMove, 1]
  }

  // The AI is the maximizing player. It loops through all possible
  // first moves to see which one *results* in the best score
  // after the opponent (minimizer) plays.
  // This loop operates in the *original* board space.
  for (const move of validMoves) {
    tempBoard[move] = player // Make the move (mutate)

    // Call minimax for the *opponent's* turn (isMaximizing = false)
    // The recursive function will handle its own reorientation.
    const score = minimaxRecursive(tempBoard, false, player, opponent)

    tempBoard[move] = 0 // Undo the move (revert)

    if (score > bestScore) {
      bestScore = score
      bestMove = move // `move` is correctly in the *original* board space
      bestMoves = [move]
    } else if (score === bestScore) {
      bestMoves.push(move)
    }
  }

  if (bestMove === -1) {
    // Should not happen unless no valid moves
    throw new Error('No valid moves found (minmaxAI)')
  }

  // If multiple best moves, pick one at random
  if (bestMoves.length > 1) {
    bestMove = bestMoves[rng.genRange(0, bestMoves.length)] as number
  }

  if (verbose === true) {
    console.log(`WinAI chooses move ${bestMove + 1} (Score: ${bestScore})`)
  }

  // Create the final resulting board
  const nextBoard: Board = [...board]
  nextBoard[bestMove] = player

  return [nextBoard, bestMove, 1]
}
