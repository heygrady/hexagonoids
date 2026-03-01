import {
  createGame,
  greatCircleDistance,
  type PlayerInputs,
  RADIUS,
  ROCK_WAVE_SIZES,
  startPlayer,
  step,
} from '@heygrady/hexagonoids-engine'

import type { AgentContext, AgentFn, SyncExecutor } from '../agents/types.js'
import {
  MEMORY_LAST_DT_MS,
  MEMORY_PREV_DISTANCES,
  MEMORY_ROCK_PERCEPTION,
} from '../agents/types.js'
import { buildRockPerceptionPrecompute } from '../encoding/collectObservations.js'
import {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  type SimulationConfig,
} from '../HexagonoidsEnvironmentConfig.js'
import { findBucketXYZ } from './icosahedralBuckets.js'
import type { SimulationProfiler } from './perfProfiler.js'
import type { RawMetrics } from './RawMetrics.js'
import { createMetricsCollector } from './RawMetrics.js'

const PLAYER_ID = 'player-1'
const PREV_DISTANCE_CLEANUP_INTERVAL = 8
const DEG_TO_RAD = Math.PI / 180

/**
 * Run a full headless game with any AgentFn and return RawMetrics.
 *
 * Loop: createGame -> startPlayer -> loop(agent -> step) -> collect metrics.
 * Ends when tick >= maxTicks or state.endedAt !== null.
 */
export function simulateGame(
  agent: AgentFn,
  config: Partial<SimulationConfig>,
  seed: string,
  executor?: SyncExecutor,
  profiler?: SimulationProfiler
): RawMetrics {
  const { maxTicks, dtMs, useFastThrust } = {
    ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation,
    ...config,
  }

  // 1. Create game
  const { state, rng } = createGame({ seed, useFastThrust })

  // 2. Start player
  startPlayer(state, PLAYER_ID, rng)
  const trackedPlayer = state.players.get(PLAYER_ID)

  // 3. Create metrics collector
  const collector = createMetricsCollector(PLAYER_ID)

  // Agent context (persists across ticks)
  const context: AgentContext = {
    rng,
    memory: {},
    executor,
  }
  const stepInputs: PlayerInputs = {
    [PLAYER_ID]: {
      left: false,
      right: false,
      thrust: false,
      fire: false,
    },
  }

  let distanceTraveled = 0
  let prevX = 0
  let prevY = 0
  let prevZ = 0
  let hasPrev = false
  let lastBucketX = 0
  let lastBucketY = 0
  let lastBucketZ = 0
  let lastBucketIdx = -1
  const seenDistanceKeys = new Set<string>()
  const visitedBuckets = new Set<number>()

  // 4. Game loop
  let tickCount = 0
  for (let tick = 0; tick < maxTicks; tick++) {
    if (state.endedAt != null) break
    tickCount = tick + 1

    // Track ship position before step for distance + spatial coverage
    const player = trackedPlayer ?? state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship?.alive) {
      // Convert lat/lng to unit-sphere XYZ once for both distance and bucket
      const latRad = ship.lat * DEG_TO_RAD
      const lngRad = ship.lng * DEG_TO_RAD
      const cosLat = Math.cos(latRad)
      const cx = cosLat * Math.cos(lngRad)
      const cy = cosLat * Math.sin(lngRad)
      const cz = Math.sin(latRad)

      // Chord distance on unit sphere (accurate for small deltas between ticks)
      if (hasPrev) {
        const dx = cx - prevX
        const dy = cy - prevY
        const dz = cz - prevZ
        distanceTraveled += Math.sqrt(dx * dx + dy * dy + dz * dz) * RADIUS
      }
      prevX = cx
      prevY = cy
      prevZ = cz
      hasPrev = true

      // Spatial coverage bucket tracking — skip scan when ship hasn't moved far
      const bdx = cx - lastBucketX
      const bdy = cy - lastBucketY
      const bdz = cz - lastBucketZ
      if (lastBucketIdx < 0 || bdx * bdx + bdy * bdy + bdz * bdz > 0.04) {
        lastBucketIdx = findBucketXYZ(cx, cy, cz)
        lastBucketX = cx
        lastBucketY = cy
        lastBucketZ = cz
      }
      visitedBuckets.add(lastBucketIdx)
    } else {
      // Ship dead or missing — reset tracking
      hasPrev = false
    }

    // Track bullet count before step to detect new shots
    const bulletsBefore = state.bullets.size

    const rockPerception =
      ship?.alive === true
        ? buildRockPerceptionPrecompute(
            state,
            ship.lat,
            ship.lng,
            Math.PI / 2 + ship.yaw
          )
        : undefined
    context.memory[MEMORY_ROCK_PERCEPTION] = rockPerception

    // Get agent inputs (reads prevDistances from previous tick)
    const agentStartedAt = profiler?.start('agent')
    const inputs = agent(state, PLAYER_ID, context)
    if (agentStartedAt != null) profiler?.stop('agent', agentStartedAt)

    // Track action usage per live frame
    collector.addActionFrame(inputs, ship?.alive === true)

    // Track rocks in SOI and unique rocks seen
    if (rockPerception != null && rockPerception.rocks.length > 0) {
      const visibleIds: string[] = []
      for (const entry of rockPerception.rocks) {
        if (entry.inVisionRange) {
          visibleIds.push(entry.id)
        }
      }
      if (visibleIds.length > 0) {
        collector.addRocksSeen(visibleIds)
        collector.addFrameWithRocksInSOI()
      }
    }

    // Update prevDistances BEFORE step so closing speed reflects movement.
    // The agent already read prevDistances above; now we snapshot current
    // pre-step distances. After step() moves entities, the next tick's
    // encodeGameState will compute delta between these and new positions.
    const memoryStartedAt = profiler?.start('memory')
    if (ship?.alive) {
      const prevDistances = context.memory[MEMORY_PREV_DISTANCES] as
        | Map<string, number>
        | undefined
      if (prevDistances != null) {
        const shouldCleanup = tick % PREV_DISTANCE_CLEANUP_INTERVAL === 0
        if (shouldCleanup) {
          seenDistanceKeys.clear()
        }

        // Reuse distances already computed by buildRockPerceptionPrecompute
        if (rockPerception != null) {
          for (const rock of rockPerception.rocks) {
            prevDistances.set(rock.id, rock.distance)
            if (shouldCleanup) seenDistanceKeys.add(rock.id)
          }
        }
        for (const bullet of state.bullets.values()) {
          const dist = greatCircleDistance(
            ship.lat,
            ship.lng,
            bullet.lat,
            bullet.lng,
            RADIUS
          )
          prevDistances.set(bullet.id, dist)
          if (shouldCleanup) seenDistanceKeys.add(bullet.id)
        }

        // Prune destroyed entities periodically to keep map growth bounded.
        if (shouldCleanup) {
          for (const id of prevDistances.keys()) {
            if (!seenDistanceKeys.has(id)) {
              prevDistances.delete(id)
            }
          }
        }
      }
    }

    // Store dtMs for encoding approach speed calculation
    context.memory[MEMORY_LAST_DT_MS] = dtMs
    if (memoryStartedAt != null) profiler?.stop('memory', memoryStartedAt)

    // Record wave before step for transition detection
    const waveBefore = state.wave

    // Step the simulation
    const stepStartedAt = profiler?.start('step')
    stepInputs[PLAYER_ID] = inputs
    step(state, stepInputs, dtMs, rng, collector.hooks)
    if (stepStartedAt != null) profiler?.stop('step', stepStartedAt)

    // Detect wave transition and track large rocks spawned
    if (state.wave > waveBefore) {
      const waveIndex = Math.min(state.wave, ROCK_WAVE_SIZES.length - 1)
      collector.addLargeRocksSpawned(ROCK_WAVE_SIZES[waveIndex] ?? 4)
    }

    // Track new bullets fired
    const newBullets = state.bullets.size - bulletsBefore
    if (newBullets > 0) {
      collector.addShotsFired(newBullets)
    }
  }

  // Final distance update
  const player = trackedPlayer ?? state.players.get(PLAYER_ID)
  const ship =
    player?.shipId != null ? state.ships.get(player.shipId) : undefined
  if (ship?.alive && hasPrev) {
    const latRad = ship.lat * DEG_TO_RAD
    const lngRad = ship.lng * DEG_TO_RAD
    const cosLat = Math.cos(latRad)
    const fx = cosLat * Math.cos(lngRad)
    const fy = cosLat * Math.sin(lngRad)
    const fz = Math.sin(latRad)
    const dx = fx - prevX
    const dy = fy - prevY
    const dz = fz - prevZ
    distanceTraveled += Math.sqrt(dx * dx + dy * dy + dz * dz) * RADIUS
  }

  // 7. Return collected metrics
  profiler?.onGameComplete(tickCount)
  collector.setUniqueCellsVisited(visitedBuckets.size)

  return collector.getMetrics({
    episodeReward: 0,
    score: player?.score ?? 0,
    livesRemaining: player?.lives ?? 0,
    timeAlive: state.now,
    distanceTraveled,
    wavesSpawned: state.wave,
  })
}
