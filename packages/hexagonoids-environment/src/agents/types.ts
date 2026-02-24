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
 * Structural subset of @neat-evolution/executor's SyncExecutor.
 * Only `execute()` is required for agent and simulation use.
 * The real SyncExecutor (isAsync + execute + executeBatch) satisfies this
 * interface via duck-typing. Import from @neat-evolution/executor directly
 * when the full interface is needed.
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
