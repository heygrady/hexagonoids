import type { GameState } from './types.js'

/** Advance game time by dtMs milliseconds */
export function advanceGameTime(state: GameState, dtMs: number): void {
  state.now += dtMs
}

/** Return elapsed game time in milliseconds since a timestamp. Returns Infinity if `since` is null. */
export function elapsed(state: GameState, since: number | null): number {
  if (since === null) return Infinity
  return state.now - since
}
