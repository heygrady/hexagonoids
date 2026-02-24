import type { GameState, PlayerInputState } from '@heygrady/hexagonoids-engine'
import type { RNG } from '@neat-evolution/utils'

/**
 * Agent function signature. Reads game state, returns button presses.
 * Never mutates state directly.
 */
export type AgentFn = (
  state: GameState,
  playerId: string,
  context: AgentContext
) => PlayerInputState

export interface AgentContext {
  rng: RNG
  memory: Record<string, unknown>
  executor?: SyncExecutor | undefined
}

/**
 * Minimal SyncExecutor interface (type-only).
 * The full @neat-evolution/executor package is not added until Phase 02b.
 */
export interface SyncExecutor {
  execute(inputs: number[]): number[]
}
