import type { RockPerceptionPrecompute } from '../encoding/collectObservations.js'
import { createObservationFrameBuffer } from '../encoding/collectObservations.js'
import { decodeOutputs } from '../encoding/decodeOutputs.js'
import { encodeGameState } from '../encoding/encodeGameState.js'
import type { ObservationFrame } from '../encoding/observationTypes.js'
import type { AgentFn } from './types.js'
import {
  MEMORY_LAST_DT_MS,
  MEMORY_PREV_DISTANCES,
  MEMORY_ROCK_PERCEPTION,
} from './types.js'

interface NeatMemory {
  prevDistances: Map<string, number>
  lastDtMs: number
  inputBuffer: number[]
  observationBuffer: ObservationFrame
  rockPerception: RockPerceptionPrecompute | undefined
}

function getMemory(memory: Record<string, unknown>): NeatMemory {
  if (memory[MEMORY_PREV_DISTANCES] == null) {
    memory[MEMORY_PREV_DISTANCES] = new Map<string, number>()
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
  memory.rockPerception = memory[MEMORY_ROCK_PERCEPTION] as
    | RockPerceptionPrecompute
    | undefined
  return memory as unknown as NeatMemory
}

/**
 * NEAT agent: encodes game state, runs executor, decodes outputs.
 * Requires `context.executor` to be set.
 */
export const neatAgent: AgentFn = (state, playerId, context) => {
  if (context.executor == null) {
    throw new Error('neatAgent requires an executor in AgentContext')
  }

  const mem = getMemory(context.memory)
  const inputs = encodeGameState(
    state,
    playerId,
    mem.prevDistances,
    mem.lastDtMs,
    mem.inputBuffer,
    mem.observationBuffer,
    mem.rockPerception
  )
  const outputs = context.executor.execute(inputs)
  return decodeOutputs(outputs)
}
