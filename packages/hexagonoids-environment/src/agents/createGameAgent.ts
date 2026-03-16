import type { EpisodicAgent } from '@neat-evolution/execution-manager'
import { selectDecoder } from '../encoding/actionDecoders.js'
import type { RockPerceptionPrecompute } from '../encoding/collectObservations.js'
import { createObservationFrameBuffer } from '../encoding/collectObservations.js'
import { encodeGameState } from '../encoding/encodeGameState.js'
import { INPUT_COUNT } from '../encoding/encodingPresets.js'

import type { AgentFn } from './types.js'
import {
  MEMORY_INPUT_BUFFER,
  MEMORY_OBSERVATION_BUFFER,
  MEMORY_ROCK_PERCEPTION,
  MEMORY_SEEN_ROCKS,
} from './types.js'

export interface GameAgent {
  readonly agent: AgentFn
  readonly episodicAgent: EpisodicAgent
  resetMemory(): void
}

/**
 * Wraps an EpisodicAgent so it can drive the existing AgentFn-based simulation
 * loops. Encodes game state into Float64Array inputs the agent expects, reusing
 * the same observation buffers as the NEAT agent so both paths see identical data.
 *
 * Unlike the old EpisodeAgentBridge, this adapter only handles encoding/decoding.
 * Episode lifecycle (startEpisode, endEpisode, reward) is owned by the caller.
 */
export function createGameAgent(rlAgent: EpisodicAgent): GameAgent {
  const floatInputs = new Float64Array(INPUT_COUNT)
  const observationBuffer = createObservationFrameBuffer()
  const seenRocks = new Set<string>()
  let inputBuffer: number[] | undefined

  const bridgedAgent: AgentFn = (state, playerId, context) => {
    const rockPerception = context.memory[MEMORY_ROCK_PERCEPTION] as
      | RockPerceptionPrecompute
      | undefined
    inputBuffer = encodeGameState(
      state,
      playerId,
      inputBuffer,
      observationBuffer,
      rockPerception,
      context.spatialQueries,
      seenRocks
    )
    context.memory[MEMORY_INPUT_BUFFER] = inputBuffer
    context.memory[MEMORY_OBSERVATION_BUFFER] = observationBuffer
    context.memory[MEMORY_SEEN_ROCKS] = seenRocks

    for (let i = 0; i < INPUT_COUNT; i++) {
      floatInputs[i] = inputBuffer[i] ?? 0
    }

    const actionOutputs = rlAgent.act(floatInputs)
    return selectDecoder(actionOutputs.length)(actionOutputs)
  }

  return {
    agent: bridgedAgent,
    episodicAgent: rlAgent,
    resetMemory() {
      seenRocks.clear()
    },
  }
}
