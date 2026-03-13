import type { RockPerceptionPrecompute } from '../encoding/collectObservations.js'
import { createObservationFrameBuffer } from '../encoding/collectObservations.js'
import { decodeOutputs } from '../encoding/decodeOutputs.js'
import { encodeGameState } from '../encoding/encodeGameState.js'
import type { ObservationFrame } from '../encoding/observationTypes.js'
import type { AgentFn } from './types.js'
import {
  MEMORY_INPUT_BUFFER,
  MEMORY_OBSERVATION_BUFFER,
  MEMORY_SEEN_ROCKS,
} from './types.js'

interface NeatMemory {
  seenRocks: Set<string>
  inputBuffer: number[]
  observationBuffer: ObservationFrame
  rockPerception: RockPerceptionPrecompute | undefined
}

function getMemory(memory: Record<string, unknown>): NeatMemory {
  if (memory[MEMORY_SEEN_ROCKS] == null) {
    memory[MEMORY_SEEN_ROCKS] = new Set<string>()
  }
  if (memory[MEMORY_INPUT_BUFFER] == null) {
    memory[MEMORY_INPUT_BUFFER] = []
  }
  if (memory[MEMORY_OBSERVATION_BUFFER] == null) {
    memory[MEMORY_OBSERVATION_BUFFER] = createObservationFrameBuffer()
  }
  return memory as unknown as NeatMemory
}

/**
 * NEAT agent: encodes game state, runs executor, decodes outputs.
 * Requires `context.executor` to be set.
 *
 * Post-processing pipeline:
 * 1. Encode game state → 34 input floats (2 ship + 8 cones × 4 features)
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
      mem.inputBuffer,
      mem.observationBuffer,
      mem.rockPerception,
      context.spatialQueries,
      mem.seenRocks
    )
    if (mem.inputBuffer !== inputs) {
      mem.inputBuffer = inputs
      context.memory[MEMORY_INPUT_BUFFER] = inputs
    }
    const outputs = context.executor.execute(inputs)
    return decodeOutputs(outputs)
  }
}

export const neatAgent: AgentFn = createNeatAgent()
