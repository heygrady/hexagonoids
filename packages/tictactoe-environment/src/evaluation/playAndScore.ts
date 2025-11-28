import {
  checkState,
  getInitialBoard,
  type Player,
  type PlayerFn,
  type PlayerOptions,
} from '@heygrady/tictactoe-game'

import { calculateScore } from '../scoring/calculateScore.js'
import type { GameResult } from '../types/evaluation.js'
import type {
  ConfidenceMultiplierConfig,
  GameOutcomeScores,
  MoveWeightingConfig,
} from '../types/scoring.js'

/**
 * Plays a single game between two players and returns detailed results
 * including who won and all move confidence scores.
 * @param {PlayerFn} playerAFunc - Player 1 (uses internal PlayerFn)
 * @param {PlayerFn} playerBFunc - Player -1 (uses internal PlayerFn)
 * @param {Player} [firstPlayer] - Which player starts (1 or -1)
 * @param {PlayerOptions} [options] - Player options (including RNG)
 * @returns {GameResult} GameResult with win status and move scores
 */
export function playGame(
  playerAFunc: PlayerFn,
  playerBFunc: PlayerFn,
  firstPlayer: Player = 1,
  options?: PlayerOptions
): GameResult {
  let board = getInitialBoard()
  let currentPlayer: Player = firstPlayer

  const aScores: number[] = []
  const bScores: number[] = []

  for (let moveCount = 0; moveCount < 9; moveCount++) {
    let score: number

    if (currentPlayer === 1) {
      ;[board, , score] = playerAFunc(board, currentPlayer, options)
      aScores.push(score)
    } else {
      ;[board, , score] = playerBFunc(board, currentPlayer, options)
      bScores.push(score)
    }

    const [isWin, isDraw, winner] = checkState(board)
    if (isWin) {
      // winner is 1 (Player A) or -1 (Player B)
      return {
        playerAWon: winner === 1,
        playerBWon: winner === -1,
        playerAScores: aScores,
        playerBScores: bScores,
      }
    }
    if (isDraw) {
      break
    }
    currentPlayer = -currentPlayer as Player
  }

  // Draw
  return {
    playerAWon: false,
    playerBWon: false,
    playerAScores: aScores,
    playerBScores: bScores,
  }
}

/**
 * Plays a game and immediately calculates raw scores for both players.
 * This combines playGame + calculateScore to reduce boilerplate.
 * @param {PlayerFn} playerAFunc - Player 1
 * @param {PlayerFn} playerBFunc - Player -1
 * @param {Player} firstPlayer - Which player starts
 * @param {GameOutcomeScores} outcomeScores - Game outcome score configuration
 * @param {ConfidenceMultiplierConfig} confidenceConfig - Confidence multiplier configuration
 * @param {MoveWeightingConfig} moveWeightingConfig - Move weighting configuration
 * @param {PlayerOptions} [options] - Player options
 * @returns {[GameResult, number, number]} Tuple of [GameResult, rawScoreA, rawScoreB]
 */
export function playAndScore(
  playerAFunc: PlayerFn,
  playerBFunc: PlayerFn,
  firstPlayer: Player,
  outcomeScores: GameOutcomeScores,
  confidenceConfig: ConfidenceMultiplierConfig,
  moveWeightingConfig: MoveWeightingConfig,
  options?: PlayerOptions
): [GameResult, number, number] {
  const result = playGame(playerAFunc, playerBFunc, firstPlayer, options)

  const rawScoreA = calculateScore(
    result.playerAWon,
    result.playerBWon,
    result.playerAScores,
    outcomeScores,
    confidenceConfig,
    moveWeightingConfig
  )

  const rawScoreB = calculateScore(
    result.playerBWon,
    result.playerAWon,
    result.playerBScores,
    outcomeScores,
    confidenceConfig,
    moveWeightingConfig
  )

  return [result, rawScoreA, rawScoreB]
}
