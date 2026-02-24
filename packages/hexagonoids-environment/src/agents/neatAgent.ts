import { decodeOutputs } from '../encoding/decodeOutputs.js'
import { encodeGameState } from '../encoding/encodeGameState.js'
import type { AgentFn } from './types.js'
import { MEMORY_LAST_DT_MS, MEMORY_PREV_DISTANCES } from './types.js'

interface NeatMemory {
  prevDistances: Map<string, number>
  lastDtMs: number
}

function getMemory(memory: Record<string, unknown>): NeatMemory {
  if (memory[MEMORY_PREV_DISTANCES] == null) {
    memory[MEMORY_PREV_DISTANCES] = new Map<string, number>()
  }
  if (memory[MEMORY_LAST_DT_MS] == null) {
    memory[MEMORY_LAST_DT_MS] = 33
  }
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
    mem.lastDtMs
  )
  const outputs = context.executor.execute(inputs)
  return decodeOutputs(outputs)
}
