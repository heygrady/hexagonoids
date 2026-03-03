import type { RNG } from '@neat-evolution/utils'

import type { RockPerceptionPrecompute } from '../encoding/collectObservations.js'
import {
  createObservationFrameBuffer,
  type PreviousRockProjectionMap,
} from '../encoding/collectObservations.js'
import { decodeOutputs } from '../encoding/decodeOutputs.js'
import { encodeGameState } from '../encoding/encodeGameState.js'
import {
  DEFAULT_ENCODING_PRESET,
  type EncodingPreset,
  GLOBAL_FEATURES,
  getEncodingFeaturesPerRay,
  getLidarRayCount,
} from '../encoding/encodingPresets.js'
import type { ObservationFrame } from '../encoding/observationTypes.js'
import type { AgentFn } from './types.js'
import {
  MEMORY_LAST_DT_MS,
  MEMORY_PREV_DISTANCES,
  MEMORY_PREV_PROJECTIONS,
  MEMORY_ROCK_PERCEPTION,
} from './types.js'

/**
 * Noise amplitude for empty LIDAR proximity channels.
 * Kept small so it breaks the exact-zero pattern without obscuring real hits.
 */
const LIDAR_NOISE_SCALE = 0.03

/**
 * Exponential decay factor applied per frame to previous LIDAR values.
 * At 0.85, a signal fades to ~20% after 10 frames (~330ms at 33ms/tick),
 * giving the agent short-term memory of where entities were.
 */
const LIDAR_DECAY = 0.85

/**
 * Threshold below which decayed values are zeroed to prevent infinite
 * tails of vanishingly small numbers.
 */
const DECAY_EPSILON = 0.005

interface NeatMemory {
  prevProjections: PreviousRockProjectionMap | undefined
  prevDistances: Map<string, number>
  lastDtMs: number
  inputBuffer: number[]
  observationBuffer: ObservationFrame
  rockPerception: RockPerceptionPrecompute | undefined
}

function getMemory(
  memory: Record<string, unknown>,
  needsPrevProjections: boolean,
  encodingPreset: EncodingPreset = DEFAULT_ENCODING_PRESET
): NeatMemory {
  if (needsPrevProjections) {
    if (memory[MEMORY_PREV_PROJECTIONS] == null) {
      memory[MEMORY_PREV_PROJECTIONS] = new Map<string, [number, number]>()
    }
  } else if (memory[MEMORY_PREV_PROJECTIONS] != null) {
    delete memory[MEMORY_PREV_PROJECTIONS]
  }
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
    memory.observationBuffer = createObservationFrameBuffer(encodingPreset)
  }
  memory.prevProjections = memory[MEMORY_PREV_PROJECTIONS] as
    | PreviousRockProjectionMap
    | undefined
  memory.rockPerception = memory[MEMORY_ROCK_PERCEPTION] as
    | RockPerceptionPrecompute
    | undefined
  return memory as unknown as NeatMemory
}

/**
 * Apply exponential decay trace to LIDAR channels.
 *
 * For each ray's proximity and closing-speed channels:
 * - If there's a real signal (proximity > 0), use it directly and update
 *   the trace buffer.
 * - If the ray is empty (proximity ≈ 0), use the decayed previous value
 *   so the entity "fades out" over ~10 frames instead of vanishing.
 *
 * The rock-presence flag and rock-size channel are preserved while the trace
 * is active and cleared when the trace falls below epsilon.
 */
export function applyLidarDecay(
  inputs: number[],
  trace: number[],
  encodingPreset: EncodingPreset = DEFAULT_ENCODING_PRESET
): void {
  const featuresPerRay = getEncodingFeaturesPerRay(encodingPreset)
  const rayCount = getLidarRayCount(encodingPreset)
  for (let r = 0; r < rayCount; r++) {
    const base = GLOBAL_FEATURES + r * featuresPerRay
    const traceBase = r * featuresPerRay

    const rawProximity = inputs[base] ?? 0
    const rawClosing = inputs[base + 1] ?? 0
    const rawRockSize = inputs[base + 2] ?? 0
    const rawBearingOffset = inputs[base + 3] ?? 0

    if (rawProximity > DECAY_EPSILON) {
      // Real signal — use it and update trace
      trace[traceBase] = rawProximity
      trace[traceBase + 1] = rawClosing
      trace[traceBase + 2] = rawRockSize
      trace[traceBase + 3] = rawBearingOffset
      for (let i = 4; i < featuresPerRay; i++) {
        trace[traceBase + i] = inputs[base + i] ?? 0
      }
    } else {
      // No signal — decay the trace
      const prevProx = (trace[traceBase] ?? 0) * LIDAR_DECAY
      if (prevProx > DECAY_EPSILON) {
        const prevClosing = (trace[traceBase + 1] ?? 0) * LIDAR_DECAY
        inputs[base] = prevProx
        inputs[base + 1] = prevClosing
        // Preserve other channels while the trace is active.
        for (let i = 2; i < featuresPerRay; i++) {
          inputs[base + i] = trace[traceBase + i] ?? 0
        }
        trace[traceBase] = prevProx
        trace[traceBase + 1] = prevClosing
      } else {
        // Trace fully decayed — clear
        for (let i = 0; i < featuresPerRay; i++) {
          trace[traceBase + i] = 0
        }
      }
    }
  }
}

/**
 * Add low-level noise only to empty LIDAR proximity channels.
 * This avoids mutating real detections or inventing fake relative motion.
 */
function addLidarNoise(
  inputs: number[],
  rng: RNG,
  encodingPreset: EncodingPreset
): void {
  const featuresPerRay = getEncodingFeaturesPerRay(encodingPreset)
  const rayCount = getLidarRayCount(encodingPreset)
  const isCone8 = encodingPreset === 'cone8'
  for (let r = 0; r < rayCount; r++) {
    const base = GLOBAL_FEATURES + r * featuresPerRay
    const proximity = inputs[base] ?? 0
    if (proximity > DECAY_EPSILON) continue
    // cone8 has no rockSize channel; ray presets check rockSize at index 2
    if (!isCone8) {
      const rockSize = inputs[base + 2] ?? 0
      if (rockSize > 0) continue
    }
    inputs[base] = rng.gen() * LIDAR_NOISE_SCALE
  }
}

/**
 * NEAT agent: encodes game state, runs executor, decodes outputs.
 * Requires `context.executor` to be set.
 *
 * Post-processing pipeline:
 * 1. Encode game state → 69 floats
 * 2. Add low-level noise to empty LIDAR rays
 * 3. Execute neural network → 4 output floats
 * 4. Decode outputs → boolean player inputs
 */
export function createNeatAgent(
  encodingPreset: EncodingPreset = DEFAULT_ENCODING_PRESET
): AgentFn {
  // cone8 needs prevProjections for tangential velocity; five/six need it for bearingDrift
  const needsPrevProjections = encodingPreset !== 'four'
  return (state, playerId, context) => {
    if (context.executor == null) {
      throw new Error('neatAgent requires an executor in AgentContext')
    }
    if (context.spatialQueries == null) {
      throw new Error('neatAgent requires spatialQueries in AgentContext')
    }

    const mem = getMemory(context.memory, needsPrevProjections, encodingPreset)

    const inputs = encodeGameState(
      state,
      playerId,
      mem.prevProjections,
      mem.prevDistances,
      mem.lastDtMs,
      mem.inputBuffer,
      mem.observationBuffer,
      mem.rockPerception,
      encodingPreset,
      context.spatialQueries
    )
    if (mem.inputBuffer !== inputs) {
      mem.inputBuffer = inputs
      context.memory.inputBuffer = inputs
    }
    addLidarNoise(inputs, context.rng, encodingPreset)
    const outputs = context.executor.execute(inputs)
    return decodeOutputs(outputs)
  }
}

export const neatAgent: AgentFn = createNeatAgent()
