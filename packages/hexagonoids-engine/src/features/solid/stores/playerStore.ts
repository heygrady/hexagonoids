import { type Accessor, createMemo } from 'solid-js'

import type { PlayerState } from '../../engine/types.js'
import type { ReactiveEngine } from '../createReactiveEngine.js'

export function usePlayer(
  engine: ReactiveEngine,
  playerId: string
): Accessor<PlayerState | undefined> {
  return createMemo(() => engine.state.players.get(playerId))
}

export function usePlayerScore(
  engine: ReactiveEngine,
  playerId: string
): Accessor<number> {
  return createMemo(() => engine.state.players.get(playerId)?.score ?? 0)
}

export function usePlayerLives(
  engine: ReactiveEngine,
  playerId: string
): Accessor<number> {
  return createMemo(() => engine.state.players.get(playerId)?.lives ?? 0)
}
