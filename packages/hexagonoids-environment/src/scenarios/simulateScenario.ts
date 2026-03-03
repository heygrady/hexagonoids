import {
  type PlayerInputs,
  RADIUS,
  ROCK_WAVE_SIZES,
} from '@heygrady/hexagonoids-engine'

import type { AgentContext, AgentFn, SyncExecutor } from '../agents/types.js'
import {
  MEMORY_LAST_DT_MS,
  MEMORY_PREV_DISTANCES,
  MEMORY_PREV_PROJECTIONS,
  MEMORY_ROCK_PERCEPTION,
} from '../agents/types.js'
import { buildRockPerceptionPrecompute } from '../encoding/collectObservations.js'
import { findBucketXYZ } from '../evaluation/icosahedralBuckets.js'
import type { RawMetrics } from '../evaluation/RawMetrics.js'
import { createMetricsCollector } from '../evaluation/RawMetrics.js'
import {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  type SimulationConfig,
} from '../HexagonoidsEnvironmentConfig.js'

import { restoreSnapshot } from './restoreSnapshot.js'
import type { ScenarioSnapshot } from './types.js'

const PLAYER_ID = 'player-1'
const PREV_DISTANCE_CLEANUP_INTERVAL = 8
/**
 * Run a short headless evaluation starting from a restored scenario snapshot.
 *
 * Mirrors `simulateGame` but initializes from `restoreSnapshot()` instead of
 * `createGame()` + `startPlayer()`. Default maxTicks is 120 (caller passes
 * via config).
 */
export function simulateScenario(
  agent: AgentFn,
  scenario: ScenarioSnapshot,
  config: Partial<SimulationConfig>,
  seed: string,
  executor?: SyncExecutor
): RawMetrics {
  const { maxTicks, dtMs } = {
    ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation,
    ...config,
  }

  // 1. Restore game from snapshot
  const engine = restoreSnapshot(scenario, seed)
  const { state, rng } = engine

  // Capture baselines for delta metrics
  const baselineGameTime = state.now
  const baselineScore = scenario.player.score
  const baselineWave = state.wave

  // 2. Get player reference
  const trackedPlayer = state.players.get(PLAYER_ID)

  // 3. Create metrics collector
  const collector = createMetricsCollector(PLAYER_ID)

  // Agent context (persists across ticks)
  const context: AgentContext = {
    rng,
    memory: {},
    executor,
    spatialQueries: engine,
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

  const shipPoint = (target: {
    lat: number
    lng: number
    x?: number
    y?: number
    z?: number
  }) => {
    if (target.x != null && target.y != null && target.z != null) {
      return [target.x, target.y, target.z] as const
    }
    const latRad = (target.lat * Math.PI) / 180
    const lngRad = (target.lng * Math.PI) / 180
    const cosLat = Math.cos(latRad)
    return [
      cosLat * Math.cos(lngRad),
      Math.sin(latRad),
      cosLat * Math.sin(lngRad),
    ] as const
  }

  // 4. Game loop
  for (let tick = 0; tick < maxTicks; tick++) {
    if (state.endedAt != null) break

    // Track ship position before step for distance + spatial coverage
    const player = trackedPlayer ?? state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship?.alive) {
      const [cx, cy, cz] = shipPoint(ship)

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
            {
              x: ship.x ?? 0,
              y: ship.y ?? 1,
              z: ship.z ?? 0,
            },
            Math.PI / 2 + ship.yaw,
            engine
          )
        : undefined
    context.memory[MEMORY_ROCK_PERCEPTION] = rockPerception

    // Get agent inputs (reads prevDistances from previous tick)
    const inputs = agent(state, PLAYER_ID, context)

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
    if (ship?.alive) {
      const prevProjections = context.memory[MEMORY_PREV_PROJECTIONS] as
        | Map<string, [number, number]>
        | undefined
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
            if (prevProjections != null) {
              const existing = prevProjections.get(rock.id)
              if (existing != null) {
                existing[0] = rock.localX
                existing[1] = rock.localY
              } else {
                prevProjections.set(rock.id, [rock.localX, rock.localY])
              }
            }
            if (shouldCleanup) seenDistanceKeys.add(rock.id)
          }
        }
        // Prune destroyed entities periodically to keep map growth bounded.
        if (shouldCleanup) {
          for (const id of prevDistances.keys()) {
            if (!seenDistanceKeys.has(id)) {
              prevDistances.delete(id)
              prevProjections?.delete(id)
            }
          }
        }
      }
    }

    // Store dtMs for encoding approach speed calculation
    context.memory[MEMORY_LAST_DT_MS] = dtMs

    // Record wave before step for transition detection
    const waveBefore = state.wave

    // Step the simulation
    stepInputs[PLAYER_ID] = inputs
    engine.tick(stepInputs, dtMs, collector.hooks)

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
    const [fx, fy, fz] = shipPoint(ship)
    const dx = fx - prevX
    const dy = fy - prevY
    const dz = fz - prevZ
    distanceTraveled += Math.sqrt(dx * dx + dy * dy + dz * dz) * RADIUS
  }

  // 7. Return collected metrics
  collector.setUniqueCellsVisited(visitedBuckets.size)

  return collector.getMetrics({
    episodeReward: 0,
    score: (player?.score ?? 0) - baselineScore,
    livesRemaining: player?.lives ?? 0,
    timeAlive: state.now - baselineGameTime,
    distanceTraveled,
    wavesSpawned: state.wave - baselineWave,
  })
}
