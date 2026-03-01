import type { RNG } from '@neat-evolution/utils'

import type { RockPerceptionPrecompute } from '../encoding/collectObservations.js'
import {
  createObservationFrameBuffer,
  LIDAR_RAY_COUNT,
} from '../encoding/collectObservations.js'
import { decodeOutputs } from '../encoding/decodeOutputs.js'
import { encodeGameState } from '../encoding/encodeGameState.js'
import type { ObservationFrame } from '../encoding/observationTypes.js'
import type { AgentFn } from './types.js'
import {
  MEMORY_LAST_DT_MS,
  MEMORY_PREV_DISTANCES,
  MEMORY_ROCK_PERCEPTION,
} from './types.js'

const GLOBAL_FEATURES = 5
const FEATURES_PER_RAY = 4
const LIDAR_CHANNELS = LIDAR_RAY_COUNT * FEATURES_PER_RAY

/**
 * Noise amplitude for LIDAR proximity and closing-speed channels.
 * Small enough to stay well below real signals (~0.4-0.9) but large
 * enough to break the all-zeros pattern that stalls learning.
 * Median |noise| ≈ 0.02, 95th percentile ≈ 0.06.
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
  prevDistances: Map<string, number>
  lastDtMs: number
  inputBuffer: number[]
  observationBuffer: ObservationFrame
  rockPerception: RockPerceptionPrecompute | undefined
  lidarTrace: number[] | undefined
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
 * Apply exponential decay trace to LIDAR channels.
 *
 * For each ray's proximity and closing-speed channels:
 * - If there's a real signal (proximity > 0), use it directly and update
 *   the trace buffer.
 * - If the ray is empty (proximity ≈ 0), use the decayed previous value
 *   so the entity "fades out" over ~10 frames instead of vanishing.
 *
 * Binary flags (isRock, isBullet) are set to 1 while the trace is active
 * and cleared when the trace falls below epsilon.
 */
export function applyLidarDecay(inputs: number[], trace: number[]): void {
  for (let r = 0; r < LIDAR_RAY_COUNT; r++) {
    const base = GLOBAL_FEATURES + r * FEATURES_PER_RAY
    const traceBase = r * FEATURES_PER_RAY

    const rawProximity = inputs[base] ?? 0
    const rawClosing = inputs[base + 1] ?? 0
    const rawIsRock = inputs[base + 2] ?? 0
    const rawIsBullet = inputs[base + 3] ?? 0

    if (rawProximity > DECAY_EPSILON) {
      // Real signal — use it and update trace
      trace[traceBase] = rawProximity
      trace[traceBase + 1] = rawClosing
      trace[traceBase + 2] = rawIsRock
      trace[traceBase + 3] = rawIsBullet
    } else {
      // No signal — decay the trace
      const prevProx = (trace[traceBase] ?? 0) * LIDAR_DECAY
      if (prevProx > DECAY_EPSILON) {
        const prevClosing = (trace[traceBase + 1] ?? 0) * LIDAR_DECAY
        inputs[base] = prevProx
        inputs[base + 1] = prevClosing
        // Preserve entity type flags while trace is active
        inputs[base + 2] = trace[traceBase + 2] ?? 0
        inputs[base + 3] = trace[traceBase + 3] ?? 0
        trace[traceBase] = prevProx
        trace[traceBase + 1] = prevClosing
      } else {
        // Trace fully decayed — clear
        trace[traceBase] = 0
        trace[traceBase + 1] = 0
        trace[traceBase + 2] = 0
        trace[traceBase + 3] = 0
      }
    }
  }
}

/**
 * Add low-level Gaussian noise to LIDAR proximity and closing-speed
 * channels. Keeps the network active during empty-vision frames
 * instead of receiving static zeros.
 * Binary flags (isRock, isBullet) are left clean.
 */
function addLidarNoise(inputs: number[], rng: RNG): void {
  for (let r = 0; r < LIDAR_RAY_COUNT; r++) {
    const base = GLOBAL_FEATURES + r * FEATURES_PER_RAY
    // Box-Muller for two independent Gaussian samples
    const u1 = rng.gen() || 1e-12 // avoid log(0)
    const u2 = rng.gen()
    const mag = LIDAR_NOISE_SCALE * Math.sqrt(-2 * Math.log(u1))
    const theta = 2 * Math.PI * u2
    inputs[base] = (inputs[base] ?? 0) + mag * Math.cos(theta) // proximity noise
    inputs[base + 1] = (inputs[base + 1] ?? 0) + mag * Math.sin(theta) // closingSpeed noise
  }
}

/**
 * NEAT agent: encodes game state, runs executor, decodes outputs.
 * Requires `context.executor` to be set.
 *
 * Post-processing pipeline:
 * 1. Encode game state → 133 floats
 * 2. Apply decay trace → fading memory of departed entities
 * 3. Add Gaussian noise → break static-zero patterns
 * 4. Execute neural network → 4 output floats
 * 5. Decode outputs → boolean player inputs
 */
export const neatAgent: AgentFn = (state, playerId, context) => {
  if (context.executor == null) {
    throw new Error('neatAgent requires an executor in AgentContext')
  }

  const mem = getMemory(context.memory)

  // Lazily allocate trace buffer
  if (mem.lidarTrace == null) {
    mem.lidarTrace = new Array<number>(LIDAR_CHANNELS).fill(0)
    context.memory.lidarTrace = mem.lidarTrace
  }

  const inputs = encodeGameState(
    state,
    playerId,
    mem.prevDistances,
    mem.lastDtMs,
    mem.inputBuffer,
    mem.observationBuffer,
    mem.rockPerception
  )
  // TODO: re-enable decay trace after tuning
  // applyLidarDecay(inputs, mem.lidarTrace)
  addLidarNoise(inputs, context.rng)
  const outputs = context.executor.execute(inputs)
  return decodeOutputs(outputs)
}
