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

/**
 * Memory keys shared between neatAgent and simulateGame.
 * Using named constants prevents silent breakage from string drift.
 */
export const MEMORY_PREV_DISTANCES = 'prevDistances'
export const MEMORY_LAST_DT_MS = 'lastDtMs'
