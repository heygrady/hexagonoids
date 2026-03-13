import type {
  EpisodeInfo,
  EpisodeResult,
  EpisodicAgent,
  TransitionInfo,
} from '@neat-evolution/environment'

import type { AgentFn } from '../agents/types.js'
import {
  MEMORY_INPUT_BUFFER,
  MEMORY_OBSERVATION_BUFFER,
  MEMORY_ROCK_PERCEPTION,
  MEMORY_SEEN_ROCKS,
} from '../agents/types.js'
import type { RockPerceptionPrecompute } from '../encoding/collectObservations.js'
import { createObservationFrameBuffer } from '../encoding/collectObservations.js'
import { decodeOutputs } from '../encoding/decodeOutputs.js'
import { encodeGameState } from '../encoding/encodeGameState.js'
import { INPUT_COUNT } from '../encoding/encodingPresets.js'

export interface EpisodeAgentBridge {
  readonly agent: AgentFn
  startEpisode(info: EpisodeInfo): void
  reward(value: number, done: boolean): void
  transitionInfo(info: TransitionInfo): void
  endEpisode(result: EpisodeResult): void
}

type TransitionAwareAgent = EpisodicAgent & {
  setTransitionInfo?: (info: TransitionInfo) => void
}

/**
 * Wraps an EpisodicAgent so it can drive the existing AgentFn-based simulation
 * loops while exposing the standard episode lifecycle hooks.
 *
 * The bridge encodes the current game state into the Float64Array inputs the
 * RL agent expects, reusing the same observation buffers as the NEAT agent so
 * both paths see identical data.
 */
export function createRLEpisodeBridge(
  agent: EpisodicAgent
): EpisodeAgentBridge {
  const rlAgent = agent as TransitionAwareAgent
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
    return decodeOutputs(actionOutputs)
  }

  return {
    agent: bridgedAgent,
    startEpisode(info) {
      rlAgent.startEpisode(info)
    },
    reward(value, done) {
      rlAgent.reward(value, done)
    },
    transitionInfo(info) {
      rlAgent.setTransitionInfo?.(info)
    },
    endEpisode(result) {
      rlAgent.endEpisode(result)
      seenRocks.clear()
    },
  }
}
