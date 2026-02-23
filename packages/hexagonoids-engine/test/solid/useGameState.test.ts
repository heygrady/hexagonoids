import { createRoot } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { useGameState } from '../../src/features/solid/index.js'

describe('useGameState', () => {
  it('throws when called outside a provider', () => {
    createRoot((dispose) => {
      expect(() => useGameState()).toThrow(
        'useGameState must be used within GameStateProvider'
      )
      dispose()
    })
  })
})
