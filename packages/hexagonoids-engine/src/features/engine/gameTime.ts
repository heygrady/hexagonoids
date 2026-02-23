import type { GameState } from './types.js'

/** Advance game time by dt seconds */
export function advanceGameTime(state: GameState, dt: number): void {
  state.now += dt * 1000
}

/** Return elapsed game time in milliseconds since a timestamp. Returns Infinity if `since` is null. */
export function elapsed(state: GameState, since: number | null): number {
  if (since === null) return Infinity
  return state.now - since
}
