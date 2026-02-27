import {
  createGame,
  greatCircleDistance,
  MAX_SPEED,
  type PlayerInputs,
  RADIUS,
  ROCK_WAVE_SIZES,
  startPlayer,
  step,
} from '@heygrady/hexagonoids-engine'
import QuickLRU from 'quick-lru'

import type { AgentContext, AgentFn, SyncExecutor } from '../agents/types.js'
import {
  MEMORY_LAST_DT_MS,
  MEMORY_PREV_DISTANCES,
  MEMORY_ROCK_PERCEPTION,
} from '../agents/types.js'
import {
  buildRockPerceptionPrecompute,
  type RockPerceptionPrecompute,
} from '../encoding/collectObservations.js'
import {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  type SimulationConfig,
} from '../HexagonoidsEnvironmentConfig.js'
import { findBucketXYZ } from './icosahedralBuckets.js'
import type { SimulationProfiler } from './perfProfiler.js'
import type { RawMetrics } from './RawMetrics.js'
import { createMetricsCollector } from './RawMetrics.js'

const PLAYER_ID = 'player-1'
const FRAME_IDLE_PENALTY = 0.01
const FIRE_PENALTY = 1
const ROCK_DESTROY_REWARD = 100
const DEATH_PENALTY = 100
const ALIGNMENT_REWARD_SCALE = 0.1
const ALIGNMENT_THRESHOLD = 0.8
const OFF_ACTION_PENALTY = 0.5
const OFF_ACTION_THRESHOLD = 2.8
const HIGH_SPEED_PENALTY = 0.1
const HIGH_SPEED_THRESHOLD = MAX_SPEED * 0.8
const PREV_DISTANCE_CLEANUP_INTERVAL = 8
const TWO_PI = Math.PI * 2
const DEG_TO_RAD = Math.PI / 180
const MIN_CENTROID_VECTOR_LENGTH = 1e-9
const HIGH_SPEED_THRESHOLD_SQUARED = HIGH_SPEED_THRESHOLD * HIGH_SPEED_THRESHOLD
const ROCK_KEY_CACHE = new QuickLRU<string, string>({ maxSize: 8192 })
const BULLET_KEY_CACHE = new QuickLRU<string, string>({ maxSize: 8192 })

function rockDistanceKey(id: string): string {
  const cached = ROCK_KEY_CACHE.get(id)
  if (cached != null) return cached
  const key = `rock:${id}`
  ROCK_KEY_CACHE.set(id, key)
  return key
}

function bulletDistanceKey(id: string): string {
  const cached = BULLET_KEY_CACHE.get(id)
  if (cached != null) return cached
  const key = `bullet:${id}`
  BULLET_KEY_CACHE.set(id, key)
  return key
}

function wrapRadians(value: number): number {
  let wrapped = value
  while (wrapped > Math.PI) wrapped -= TWO_PI
  while (wrapped < -Math.PI) wrapped += TWO_PI
  return wrapped
}

function rockRewardSignals(
  rockPerception: RockPerceptionPrecompute | undefined
): { alignment: number; offActionDistance: number } {
  if (rockPerception == null || !rockPerception.hasNearest) {
    return { alignment: 0, offActionDistance: 0 }
  }

  const centroidLength = Math.sqrt(
    rockPerception.centroidX * rockPerception.centroidX +
      rockPerception.centroidY * rockPerception.centroidY +
      rockPerception.centroidZ * rockPerception.centroidZ
  )
  let offActionDistance = 0
  if (centroidLength > MIN_CENTROID_VECTOR_LENGTH) {
    const invLen = 1 / centroidLength
    const centerX = rockPerception.centroidX * invLen
    const centerY = rockPerception.centroidY * invLen
    const centerZ = rockPerception.centroidZ * invLen
    const centerPhi = Math.atan2(
      centerZ,
      Math.sqrt(centerX * centerX + centerY * centerY)
    )
    const centerLambda = Math.atan2(centerY, centerX)
    const dPhi = centerPhi - rockPerception.shipLatRad
    const dLambda = wrapRadians(centerLambda - rockPerception.shipLngRad)
    const sinHalfPhi = Math.sin(dPhi * 0.5)
    const sinHalfLambda = Math.sin(dLambda * 0.5)
    const centerCosPhi = Math.cos(centerPhi)
    const a =
      sinHalfPhi * sinHalfPhi +
      rockPerception.shipCosLat * centerCosPhi * sinHalfLambda * sinHalfLambda
    offActionDistance =
      RADIUS * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
  }

  return {
    alignment: Math.cos(rockPerception.nearestRelativeBearing),
    offActionDistance,
  }
}

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
  let episodeReward = 0
  let prevLat: number | null = null
  let prevLng: number | null = null
  const seenDistanceKeys = new Set<string>()
  const visitedBuckets = new Set<number>()

  // 4. Game loop
  let tickCount = 0
  for (let tick = 0; tick < maxTicks; tick++) {
    if (state.endedAt != null) break
    tickCount = tick + 1

    // Track ship position before step for distance
    const player = trackedPlayer ?? state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship?.alive) {
      if (prevLat != null && prevLng != null) {
        distanceTraveled += greatCircleDistance(
          prevLat,
          prevLng,
          ship.lat,
          ship.lng,
          RADIUS
        )
      }
      prevLat = ship.lat
      prevLng = ship.lng

      // Spatial coverage bucket tracking
      const latRad = ship.lat * DEG_TO_RAD
      const lngRad = ship.lng * DEG_TO_RAD
      const cosLat = Math.cos(latRad)
      const bx = cosLat * Math.cos(lngRad)
      const by = cosLat * Math.sin(lngRad)
      const bz = Math.sin(latRad)
      visitedBuckets.add(findBucketXYZ(bx, by, bz))
    } else {
      // Ship dead or missing — reset tracking
      prevLat = null
      prevLng = null
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
    const rockSignals = rockRewardSignals(rockPerception)

    // Get agent inputs
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

    const rewardStartedAt = profiler?.start('reward')
    const frameEvents = collector.consumeFrameEvents()
    let frameReward = -FRAME_IDLE_PENALTY
    frameReward -= newBullets * FIRE_PENALTY
    frameReward += frameEvents.rocksDestroyed * ROCK_DESTROY_REWARD
    frameReward -= frameEvents.deaths * DEATH_PENALTY
    if (rockSignals.alignment > ALIGNMENT_THRESHOLD) {
      frameReward += rockSignals.alignment * ALIGNMENT_REWARD_SCALE
    }

    const playerNow = trackedPlayer ?? state.players.get(PLAYER_ID)
    const shipNow =
      playerNow?.shipId != null ? state.ships.get(playerNow.shipId) : undefined
    if (shipNow?.alive === true) {
      if (rockSignals.offActionDistance > OFF_ACTION_THRESHOLD) {
        frameReward -= OFF_ACTION_PENALTY
      }
      if (
        shipNow.angularVelocity.lengthSquared() > HIGH_SPEED_THRESHOLD_SQUARED
      ) {
        frameReward -= HIGH_SPEED_PENALTY
      }
    }
    episodeReward += frameReward
    if (rewardStartedAt != null) profiler?.stop('reward', rewardStartedAt)

    // Update prevDistances for approach speed tracking (used by neatAgent encoding)
    const memoryStartedAt = profiler?.start('memory')
    const playerAfter = trackedPlayer ?? state.players.get(PLAYER_ID)
    const shipAfter =
      playerAfter?.shipId != null
        ? state.ships.get(playerAfter.shipId)
        : undefined
    if (shipAfter?.alive) {
      const prevDistances = context.memory[MEMORY_PREV_DISTANCES] as
        | Map<string, number>
        | undefined
      if (prevDistances != null) {
        const shouldCleanup = tick % PREV_DISTANCE_CLEANUP_INTERVAL === 0
        if (shouldCleanup) {
          seenDistanceKeys.clear()
        }

        for (const rock of state.rocks.values()) {
          const key = rockDistanceKey(rock.id)
          const dist = greatCircleDistance(
            shipAfter.lat,
            shipAfter.lng,
            rock.lat,
            rock.lng,
            RADIUS
          )
          prevDistances.set(key, dist)
          if (shouldCleanup) seenDistanceKeys.add(key)
        }
        for (const bullet of state.bullets.values()) {
          const key = bulletDistanceKey(bullet.id)
          const dist = greatCircleDistance(
            shipAfter.lat,
            shipAfter.lng,
            bullet.lat,
            bullet.lng,
            RADIUS
          )
          prevDistances.set(key, dist)
          if (shouldCleanup) seenDistanceKeys.add(key)
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
  }

  // Final distance update
  const player = trackedPlayer ?? state.players.get(PLAYER_ID)
  const ship =
    player?.shipId != null ? state.ships.get(player.shipId) : undefined
  if (ship?.alive && prevLat != null && prevLng != null) {
    distanceTraveled += greatCircleDistance(
      prevLat,
      prevLng,
      ship.lat,
      ship.lng,
      RADIUS
    )
  }

  // 7. Return collected metrics
  profiler?.onGameComplete(tickCount)
  collector.setUniqueCellsVisited(visitedBuckets.size)

  return collector.getMetrics({
    episodeReward,
    score: player?.score ?? 0,
    livesRemaining: player?.lives ?? 0,
    timeAlive: state.now,
    distanceTraveled,
    wavesSpawned: state.wave,
  })
}
