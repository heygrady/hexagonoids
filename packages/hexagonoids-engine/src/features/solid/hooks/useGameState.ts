import { createContext, useContext } from 'solid-js'

import type { ReactiveEngine } from '../createReactiveEngine.js'

export const GameStateContext = createContext<ReactiveEngine>()

export function useGameState(): ReactiveEngine {
  const ctx = useContext(GameStateContext)
  if (!ctx)
    throw new Error('useGameState must be used within GameStateProvider')
  return ctx
}
