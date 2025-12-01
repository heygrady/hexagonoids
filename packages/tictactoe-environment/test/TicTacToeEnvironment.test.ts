import type { SyncExecutor } from '@neat-evolution/executor'
import { describe, expect, test, vi, beforeEach } from 'vitest'

import { TicTacToeEnvironment } from '../src/TicTacToeEnvironment.js'

// Helper to create a mock executor. We only need a unique instance for Map keys.
const mockExecutor = (_name: string): SyncExecutor => {
  return {
    execute: vi.fn(() => Array(9).fill(0.1)),
  }
}

describe('TicTacToeEnvironment', () => {
  let environment: TicTacToeEnvironment

  beforeEach(() => {
    environment = new TicTacToeEnvironment()
    vi.restoreAllMocks()
  })

  test('should have correct description', () => {
    expect(environment.description).toEqual({ inputs: 18, outputs: 9 })
    expect(environment.isAsync).toBe(false)
  })

  describe('evaluateBatch', () => {
    test('should throw an error if not exactly two executors are provided', () => {
      const execA = mockExecutor('A')
      expect(() => environment.evaluateBatch([])).toThrow(
        'TicTacToeEnvironment evaluateBatch expects 2 executors (a single match), but received 0.'
      )
      expect(() => environment.evaluateBatch([execA])).toThrow(
        'TicTacToeEnvironment evaluateBatch expects 2 executors (a single match), but received 1.'
      )
      expect(() => environment.evaluateBatch([execA, execA, execA])).toThrow(
        'TicTacToeEnvironment evaluateBatch expects 2 executors (a single match), but received 3.'
      )
    })

    test('should evaluate a single match between two executors', () => {
      const execA = mockExecutor('A')
      const execB = mockExecutor('B')

      const scores = environment.evaluateBatch([execA, execB])
      expect(scores).toHaveLength(2)

      // With uniform probability executors (low decisiveness):
      // - Entropy is maximum (log2(9) ≈ 3.17)
      // - Decisiveness = 0
      // - Move scores ≈ validProbMass * 0.5
      // - These low confidence scores get weighted and reduce the game outcome scores
      // Scores should be in valid range (can be negative for losses, positive for wins)
      expect(scores[0]).toBeDefined()
      expect(scores[1]).toBeDefined()
      expect(scores[0]).toBeGreaterThan(-1) // Worst case: loss with low confidence
      expect(scores[1]).toBeGreaterThan(-1)
      expect(scores[0]).toBeLessThan(5) // Best case: win with perfect confidence
      expect(scores[1]).toBeLessThan(5)
    })
  })
})
