import {
  heuristicAI,
  minimaxAI,
  simpleAI,
  randomAI,
  sleeperAI,
  type PlayerFn,
} from '@heygrady/tictactoe-game'

import type { OpponentType } from '../types/evaluation.js'

/**
 * Resolves an opponent type string to its PlayerFn implementation.
 * This is needed because worker threads can't serialize function references.
 * @param {OpponentType} opponentType - The opponent type name
 * @returns {PlayerFn} The corresponding PlayerFn
 * @throws {Error} if the opponent type is not recognized
 */
export function resolveOpponent(opponentType: OpponentType): PlayerFn {
  switch (opponentType) {
    case 'minimaxAI':
      return minimaxAI
    case 'heuristicAI':
      return heuristicAI
    case 'simpleAI':
      return simpleAI
    case 'randomAI':
      return randomAI
    case 'sleeperAI':
      return sleeperAI
    default:
      // This should never happen if OpponentType is properly constrained
      throw new Error(`Unknown opponent type: ${opponentType as string}`)
  }
}
