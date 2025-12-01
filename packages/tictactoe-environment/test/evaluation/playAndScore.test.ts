import { simpleAI, type Board, type Player } from '@heygrady/tictactoe-game'
import { createRNG } from '@neat-evolution/utils'
import { describe, expect, test } from 'vitest'

import { playGame, playAndScore } from '../../src/evaluation/playAndScore.js'

describe('playGame', () => {
  test('should play a complete game between two players', () => {
    const result = playGame(simpleAI, simpleAI, 1)

    expect(result.playerAScores).toBeDefined()
    expect(result.playerBScores).toBeDefined()
    expect(typeof result.playerAWon).toBe('boolean')
    expect(typeof result.playerBWon).toBe('boolean')
  })

  test('should return exactly one winner or draw', () => {
    const result = playGame(simpleAI, simpleAI, 1)

    // Either someone won, or it's a draw (both false)
    if (result.playerAWon) {
      expect(result.playerBWon).toBe(false)
    } else if (result.playerBWon) {
      expect(result.playerAWon).toBe(false)
    }
    // Draw case: both false is valid
  })

  test('should collect move scores for both players', () => {
    const result = playGame(simpleAI, simpleAI, 1)

    // Both players should have made at least some moves
    expect(result.playerAScores.length).toBeGreaterThan(0)
    expect(result.playerBScores.length).toBeGreaterThan(0)

    // Total moves should be <= 9
    expect(
      result.playerAScores.length + result.playerBScores.length
    ).toBeLessThanOrEqual(9)

    // All scores should be numbers between 0 and 1
    result.playerAScores.forEach((score) => {
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    })
    result.playerBScores.forEach((score) => {
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    })
  })

  test('should respect first player parameter', () => {
    // When player -1 goes first, they should make the first move
    const deterministic = (
      board: Board,
      player: Player
    ): [Board, number, number] => {
      // Always play top-left if available
      const newBoard = [...board] as Board
      if (newBoard[0] === 0) {
        newBoard[0] = player
        return [newBoard, 0, 1.0]
      }
      // Otherwise find first empty
      for (let i = 0; i < 9; i++) {
        if (newBoard[i] === 0) {
          newBoard[i] = player
          return [newBoard, i, 1.0]
        }
      }
      return [newBoard, 0, 1.0]
    }

    const result = playGame(deterministic, simpleAI, -1)

    // If player B goes first, they should have one more or equal moves
    expect(result.playerBScores.length).toBeGreaterThanOrEqual(
      result.playerAScores.length
    )
  })

  test('should detect wins correctly', () => {
    // Create a player that always wins
    let moveCount = 0
    const winningPlayer = (
      board: Board,
      player: Player
    ): [Board, number, number] => {
      const newBoard = [...board] as Board
      // Play to create a winning line (top row)
      const winningMoves = [0, 1, 2]
      const move = winningMoves[moveCount % 3] ?? 0
      moveCount++

      if (newBoard[move] === 0) {
        newBoard[move] = player
        return [newBoard, move, 1.0]
      }

      // Fallback
      for (let i = 0; i < 9; i++) {
        if (newBoard[i] === 0) {
          newBoard[i] = player
          return [newBoard, i, 1.0]
        }
      }
      return [newBoard, 0, 1.0]
    }

    const losingPlayer = (
      board: Board,
      player: Player
    ): [Board, number, number] => {
      const newBoard = [...board] as Board
      // Just play randomly in available spots
      for (let i = 8; i >= 0; i--) {
        if (newBoard[i] === 0) {
          newBoard[i] = player
          return [newBoard, i, 0.5]
        }
      }
      return [newBoard, 0, 0.5]
    }

    const result = playGame(winningPlayer, losingPlayer, 1)

    // Player A should eventually win or draw (depending on blocking)
    expect(
      result.playerAWon || (!result.playerAWon && !result.playerBWon)
    ).toBe(true)
  })
})

describe('playAndScore', () => {
  const defaultOutcomes = { win: 1, loss: 0.1, draw: 1 / 3 }
  const defaultConfidence = { min: 0.5, max: 1.5 }
  const defaultWeighting = { strategy: 'recency-weighted' as const, divisor: 3 }

  test('should return game result and calculated scores', () => {
    const [result, scoreA, scoreB] = playAndScore(
      simpleAI,
      simpleAI,
      1,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    expect(result).toBeDefined()
    expect(typeof scoreA).toBe('number')
    expect(typeof scoreB).toBe('number')
  })

  test('should produce valid score values', () => {
    const [, scoreA, scoreB] = playAndScore(
      simpleAI,
      simpleAI,
      1,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    // Scores should be positive (even losses get 0.1 * 0.5 = 0.05 minimum)
    expect(scoreA).toBeGreaterThan(0)
    expect(scoreB).toBeGreaterThan(0)

    // Maximum possible: win (1) * max multiplier (1.5) = 1.5
    expect(scoreA).toBeLessThanOrEqual(1.5)
    expect(scoreB).toBeLessThanOrEqual(1.5)
  })

  test('should reflect game outcome in scores', () => {
    const [result, scoreA, scoreB] = playAndScore(
      simpleAI,
      simpleAI,
      1,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    if (result.playerAWon) {
      // Winner should generally have higher score
      expect(scoreA).toBeGreaterThan(scoreB)
    } else if (result.playerBWon) {
      expect(scoreB).toBeGreaterThan(scoreA)
    } else {
      // Draw - scores might be similar but not necessarily equal due to confidence
      expect(Math.abs(scoreA - scoreB)).toBeLessThan(1)
    }
  })

  test('should pass through RNG options', () => {
    const rng = createRNG('test-seed-12345') // Seeded RNG for deterministic results

    // Should not throw with proper RNG
    const result = playAndScore(
      simpleAI,
      simpleAI,
      1,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting,
      { rng }
    )

    expect(result).toBeDefined()
    const [gameResult, scoreA, scoreB] = result
    expect(gameResult).toBeDefined()
    expect(typeof scoreA).toBe('number')
    expect(typeof scoreB).toBe('number')
  })
})
