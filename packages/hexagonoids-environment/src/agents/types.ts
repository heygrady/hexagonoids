import type {
  GameState,
  ManagedSpatialQueries,
  PlayerInputState,
} from '@heygrady/hexagonoids-engine'
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
  spatialQueries?: Pick<ManagedSpatialQueries, 'queryRocksNear'> | undefined
}

/**
 * Memory keys shared between neatAgent and simulateGame.
 * Using named constants prevents silent breakage from string drift.
 */
export const MEMORY_ROCK_PERCEPTION = 'rockPerception'
export const MEMORY_SEEN_ROCKS = 'seenRocks'
export const MEMORY_INPUT_BUFFER = 'inputBuffer'
export const MEMORY_OBSERVATION_BUFFER = 'observationBuffer'
