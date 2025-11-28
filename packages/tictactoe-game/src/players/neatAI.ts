import { threadRNG } from '@neat-evolution/utils'

import { boardToInput } from '../board/boardToInput.js'
import { getValidMoves, type Board, type Player } from '../board/ticTacToe.js'

import type { PlayerMove, PlayerOptions } from './types.js'

/**
 * Converts raw network outputs (logits) into a probability distribution.
 * @param {number[]} logits - The raw scores from the neural network.
 * @returns {number[]} An array of probabilities that sum to 1.
 */
function softmax(logits: number[]): number[] {
  // Add a small epsilon for numerical stability
  const epsilon = 1e-8

  // Pass 1: Find max logit for numerical stability (prevents overflow)
  const maxLogit = Math.max(...logits)

  const expScores = new Array(logits.length)
  let sumExp = epsilon // Start with epsilon

  // Pass 2: Calculate exp scores and their sum simultaneously
  for (let i = 0; i < logits.length; i++) {
    const expScore = Math.exp((logits[i] as number) - maxLogit)
    expScores[i] = expScore
    sumExp += expScore
  }

  // Pass 3: Normalize to get probabilities
  for (let i = 0; i < logits.length; i++) {
    // Reuse expScores array to store final probabilities
    expScores[i] = expScores[i] / sumExp
  }

  return expScores
}

/**
 * Checks if an array of numbers is already a probability distribution
 * (i.e., values are non-negative and sum to 1).
 * @param {number[]} values - The array to check.
 * @returns {boolean} True if the array looks like a probability distribution.
 */
function isProbability(values: number[]): boolean {
  // Use a small epsilon for floating point comparison
  const epsilon = 1e-6
  let sum = 0

  for (const val of values) {
    // Check for negative values first. Probabilities cannot be negative.
    // Allow for tiny negative due to float precision.
    if (val < -epsilon) {
      return false
    }
    sum += val
  }

  // After summing all non-negative values, check if they sum to 1.
  return Math.abs(sum - 1.0) < epsilon
}

/**
 * Calculates the entropy of a probability distribution.
 * Lower entropy = more decisive = better.
 * @param {number[]} probabilities - Array of probabilities that sum to 1.
 * @returns {number} Entropy value (0 = certain, higher = more uncertain).
 */
function calculateEntropy(probabilities: number[]): number {
  let entropy = 0
  for (const p of probabilities) {
    if (p > 1e-10) {
      entropy -= p * Math.log2(p)
    }
  }
  return entropy
}

export function neatAI(
  board: Board,
  player: Player,
  options?: PlayerOptions | undefined
): PlayerMove {
  const { executor, rng = threadRNG(), verbose } = options ?? {}
  if (executor == null) {
    throw new Error('neatAI requires an executor')
  }
  const validMoves = getValidMoves(board)
  if (validMoves.length === 0) {
    throw new Error('No valid moves available (NEAT)')
  }
  let prediction: number[]
  if (validMoves.length === 9) {
    // special layout for empty board
    const input = [...new Array(9).fill(0), ...new Array(9).fill(1)]
    prediction = executor.execute(input)
  } else {
    const [input, transform] = boardToInput(board, player)
    prediction = transform(executor.execute(input) as Board)
  }

  // --- Start of Softmax Logic ---

  // 1. Convert raw scores to probabilities, *only if they aren't already*.
  // This makes the wrapper robust to the executor's output activation.
  const probabilities: number[] = isProbability(prediction)
    ? prediction
    : softmax(prediction)

  // 2. Calculate entropy and decisiveness
  const entropy = calculateEntropy(probabilities)
  const maxEntropy = Math.log2(9) // ~3.17 for 9 positions

  // Convert to decisiveness score (0 = random, 1 = certain)
  const decisiveness = 1 - entropy / maxEntropy

  // 3. Find best valid move
  let move = -1
  let bestValidProb = -Infinity
  const validSet = new Set(validMoves)
  let bestMoves: number[] = []

  // Calculate total probability mass on valid moves
  let validProbMass = 0
  for (let i = 0; i < probabilities.length; i++) {
    if (validSet.has(i)) {
      const prob = probabilities[i] as number
      validProbMass += prob

      // Track all moves with the best probability
      if (prob > bestValidProb) {
        bestValidProb = prob
        bestMoves = []
        bestMoves.push(i)
      } else if (prob === bestValidProb) {
        bestMoves.push(i)
      }
    }
  }

  // Randomly select from all moves with the best probability
  if (bestMoves.length > 0) {
    move = bestMoves[rng.genRange(0, bestMoves.length)] as number
  }

  // 4. Combine valid probability mass with decisiveness
  // This rewards both putting probability on valid moves AND being decisive
  const moveScore = validProbMass * (0.5 + 0.5 * decisiveness)

  if (verbose === true) {
    console.log(
      `Predictions (Probs): ${probabilities
        .map((value) => value.toFixed(3))
        .join(', ')}`
    )
    console.log(
      `Entropy: ${entropy.toFixed(3)}, Decisiveness: ${decisiveness.toFixed(3)}`
    )
    console.log(`Picked move ${move + 1} (Prob: ${bestValidProb.toFixed(3)})`)
    console.log(`Valid Prob Mass: ${validProbMass.toFixed(3)}`)
    console.log(`Final Score: ${moveScore.toFixed(3)}`)
  }

  // If no valid move was found (should not occur if validMoves.length > 0),
  // pick a random valid move as a fallback.
  if (move === -1) {
    move = validMoves[rng.genRange(0, validMoves.length)] as number
    if (verbose === true) {
      console.log(`🎲 Random move ${move + 1}`)
    }
  }
  const nextBoard: Board = [...board]
  nextBoard[move] = player

  return [nextBoard, move, moveScore]
}
