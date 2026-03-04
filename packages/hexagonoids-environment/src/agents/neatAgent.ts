import type { RockPerceptionPrecompute } from '../encoding/collectObservations.js'
import {
  createObservationFrameBuffer,
  type PreviousRockProjectionMap,
} from '../encoding/collectObservations.js'
import { decodeOutputs } from '../encoding/decodeOutputs.js'
import { encodeGameState } from '../encoding/encodeGameState.js'
import type { ObservationFrame } from '../encoding/observationTypes.js'
import type { AgentFn } from './types.js'
import {
  MEMORY_LAST_DT_MS,
  MEMORY_PREV_DISTANCES,
  MEMORY_PREV_PROJECTIONS,
  MEMORY_ROCK_PERCEPTION,
  MEMORY_SEEN_ROCKS,
} from './types.js'

interface NeatMemory {
  prevProjections: PreviousRockProjectionMap
  prevDistances: Map<string, number>
  seenRocks: Set<string>
  lastDtMs: number
  inputBuffer: number[]
  observationBuffer: ObservationFrame
  rockPerception: RockPerceptionPrecompute | undefined
}

function getMemory(memory: Record<string, unknown>): NeatMemory {
  if (memory[MEMORY_PREV_PROJECTIONS] == null) {
    memory[MEMORY_PREV_PROJECTIONS] = new Map<string, [number, number]>()
  }
  if (memory[MEMORY_PREV_DISTANCES] == null) {
    memory[MEMORY_PREV_DISTANCES] = new Map<string, number>()
  }
  if (memory[MEMORY_SEEN_ROCKS] == null) {
    memory[MEMORY_SEEN_ROCKS] = new Set<string>()
  }
  if (memory[MEMORY_LAST_DT_MS] == null) {
    memory[MEMORY_LAST_DT_MS] = 33
  }
  if (memory.inputBuffer == null) {
    memory.inputBuffer = []
  }
  if (memory.observationBuffer == null) {
    memory.observationBuffer = createObservationFrameBuffer()
  }
  memory.prevProjections = memory[
    MEMORY_PREV_PROJECTIONS
  ] as PreviousRockProjectionMap
  memory.seenRocks = memory[MEMORY_SEEN_ROCKS] as Set<string>
  memory.rockPerception = memory[MEMORY_ROCK_PERCEPTION] as
    | RockPerceptionPrecompute
    | undefined
  return memory as unknown as NeatMemory
}

/**
 * NEAT agent: encodes game state, runs executor, decodes outputs.
 * Requires `context.executor` to be set.
 *
 * Post-processing pipeline:
 * 1. Encode game state → 37 input floats (8 cones × 4 features + 5 global)
 * 2. Execute neural network → 4 output floats
 * 3. Decode outputs → boolean player inputs
 */
export function createNeatAgent(): AgentFn {
  return (state, playerId, context) => {
    if (context.executor == null) {
      throw new Error('neatAgent requires an executor in AgentContext')
    }
    if (context.spatialQueries == null) {
      throw new Error('neatAgent requires spatialQueries in AgentContext')
    }

    const mem = getMemory(context.memory)

    const inputs = encodeGameState(
      state,
      playerId,
      mem.prevProjections,
      mem.prevDistances,
      mem.lastDtMs,
      mem.inputBuffer,
      mem.observationBuffer,
      mem.rockPerception,
      context.spatialQueries,
      mem.seenRocks
    )
    if (mem.inputBuffer !== inputs) {
      mem.inputBuffer = inputs
      context.memory.inputBuffer = inputs
    }
    const outputs = context.executor.execute(inputs)
    return decodeOutputs(outputs)
  }
}

export const neatAgent: AgentFn = createNeatAgent()
