import type {
  GameState,
  ManagedSpatialQueries,
  PlayerInputState,
} from '@heygrady/hexagonoids-engine'
import type { SyncExecutor } from '@neat-evolution/executor'
import type { RNG } from '@neat-evolution/utils'

export type { SyncExecutor } from '@neat-evolution/executor'

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
  spatialQueries?: Pick<ManagedSpatialQueries, 'queryRocksNear'> | undefined
}

/**
 * Memory keys shared between neatAgent and simulateGame.
 * Using named constants prevents silent breakage from string drift.
 */
export const MEMORY_PREV_DISTANCES = 'prevDistances'
export const MEMORY_PREV_PROJECTIONS = 'prevProjections'
export const MEMORY_LAST_DT_MS = 'lastDtMs'
export const MEMORY_ROCK_PERCEPTION = 'rockPerception'
export const MEMORY_SEEN_ROCKS = 'seenRocks'
