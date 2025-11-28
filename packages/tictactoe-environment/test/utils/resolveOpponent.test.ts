import { heuristicAI, minimaxAI, simpleAI } from '@heygrady/tictactoe-game'
import { describe, expect, test } from 'vitest'

import { resolveOpponent } from '../../src/utils/resolveOpponent.js'

describe('resolveOpponent', () => {
  test('should resolve minimaxAI', () => {
    const opponent = resolveOpponent('minimaxAI')
    expect(opponent).toBe(minimaxAI)
  })

  test('should resolve heuristicAI', () => {
    const opponent = resolveOpponent('heuristicAI')
    expect(opponent).toBe(heuristicAI)
  })

  test('should resolve simpleAI', () => {
    const opponent = resolveOpponent('simpleAI')
    expect(opponent).toBe(simpleAI)
  })

  test('should throw error for unknown opponent type', () => {
    expect(() => resolveOpponent('unknownAI' as any)).toThrow(
      'Unknown opponent type: unknownAI'
    )
  })

  test('resolved opponents should be callable', () => {
    const minimaxFn = resolveOpponent('minimaxAI')
    const heuristicFn = resolveOpponent('heuristicAI')
    const simpleFn = resolveOpponent('simpleAI')

    expect(typeof minimaxFn).toBe('function')
    expect(typeof heuristicFn).toBe('function')
    expect(typeof simpleFn).toBe('function')
  })
})
