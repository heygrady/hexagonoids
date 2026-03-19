import type { GameState } from '@heygrady/hexagonoids-engine'
import { selectDecoder } from '../encoding/actionDecoders.js'
import type { RockPerceptionPrecompute } from '../encoding/collectObservations.js'
import { createObservationFrameBuffer } from '../encoding/collectObservations.js'
import { encodeGameState } from '../encoding/encodeGameState.js'
import { INPUT_COUNT } from '../encoding/encodingPresets.js'

import type { AgentContext, AgentFn } from './types.js'
import {
  MEMORY_INPUT_BUFFER,
  MEMORY_OBSERVATION_BUFFER,
  MEMORY_ROCK_PERCEPTION,
  MEMORY_SEEN_ROCKS,
} from './types.js'

export interface ActionController {
  act(inputs: Float64Array): Float64Array
}

export interface GameAgent {
  readonly agent: AgentFn
  observe(
    state: GameState,
    playerId: string,
    context: AgentContext
  ): Float64Array
  resetMemory(): void
}

/**
 * Wraps an act-only controller so it can drive the existing AgentFn-based simulation
 * loops. Encodes game state into Float64Array inputs the agent expects, reusing
 * the same observation buffers as the NEAT agent so both paths see identical data.
 */
export function createGameAgent(controller: ActionController): GameAgent {
  const floatInputs = new Float64Array(INPUT_COUNT)
  const observationBuffer = createObservationFrameBuffer()
  const seenRocks = new Set<string>()

  const observe = (
    state: GameState,
    playerId: string,
    context: AgentContext
  ): Float64Array => {
    const rockPerception = context.memory[MEMORY_ROCK_PERCEPTION] as
      | RockPerceptionPrecompute
      | undefined
    // Write directly into the pre-allocated Float64Array — no intermediate
    // number[] buffer. Returns the reusable buffer; callers that need a
    // durable copy (PPO act/completeStep) use Float64Array.from().
    // NOTE: returning a fresh array per call causes V8 JIT deoptimization
    // in downstream executor code due to allocation-site type instability.
    encodeGameState(
      state,
      playerId,
      floatInputs,
      observationBuffer,
      rockPerception,
      context.spatialQueries,
      seenRocks
    )
    context.memory[MEMORY_INPUT_BUFFER] = floatInputs
    context.memory[MEMORY_OBSERVATION_BUFFER] = observationBuffer
    context.memory[MEMORY_SEEN_ROCKS] = seenRocks

    return floatInputs
  }

  const bridgedAgent: AgentFn = (state, playerId, context) => {
    const observation = observe(state, playerId, context)
    const actionOutputs = controller.act(observation)
    return selectDecoder(actionOutputs.length)(actionOutputs)
  }

  return {
    agent: bridgedAgent,
    observe,
    resetMemory() {
      seenRocks.clear()
    },
  }
}
