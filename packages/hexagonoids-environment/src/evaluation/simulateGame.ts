import {
  createGame,
  greatCircleDistance,
  MAX_SPEED,
  RADIUS,
  startPlayer,
  step,
} from '@heygrady/hexagonoids-engine'

import type { AgentContext, AgentFn, SyncExecutor } from '../agents/types.js'
import { MEMORY_LAST_DT_MS, MEMORY_PREV_DISTANCES } from '../agents/types.js'
import {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  type SimulationConfig,
} from '../HexagonoidsEnvironmentConfig.js'
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

function rockRewardSignals(
  state: ReturnType<typeof createGame>['state'],
  shipLat: number,
  shipLng: number,
  shipYaw: number
): { alignment: number; offActionDistance: number } {
  if (state.rocks.size === 0) {
    return { alignment: 0, offActionDistance: 0 }
  }

  let closestDist = Number.POSITIVE_INFINITY
  let best: { lat: number; lng: number } | null = null
  let latSum = 0
  let lngSum = 0
  let rockCount = 0
  for (const rock of state.rocks.values()) {
    latSum += rock.lat
    lngSum += rock.lng
    rockCount += 1

    const dist = greatCircleDistance(
      shipLat,
      shipLng,
      rock.lat,
      rock.lng,
      RADIUS
    )
    if (dist < closestDist) {
      closestDist = dist
      best = { lat: rock.lat, lng: rock.lng }
    }
  }
  if (best == null || rockCount === 0) {
    return { alignment: 0, offActionDistance: 0 }
  }

  // Convert yaw (0=east) to bearing (0=north).
  const yawBearing = Math.PI / 2 + shipYaw
  const targetBearing = (() => {
    const DEG_TO_RAD = Math.PI / 180
    const phi1 = shipLat * DEG_TO_RAD
    const phi2 = best.lat * DEG_TO_RAD
    const dLambda = (best.lng - shipLng) * DEG_TO_RAD
    const y = Math.sin(dLambda) * Math.cos(phi2)
    const x =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda)
    return Math.atan2(y, x)
  })()

  let rel = targetBearing - yawBearing
  while (rel > Math.PI) rel -= Math.PI * 2
  while (rel < -Math.PI) rel += Math.PI * 2

  const offActionDistance = greatCircleDistance(
    shipLat,
    shipLng,
    latSum / rockCount,
    lngSum / rockCount,
    RADIUS
  )

  return {
    alignment: Math.cos(rel),
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
  executor?: SyncExecutor
): RawMetrics {
  const { maxTicks, dtMs } = {
    ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation,
    ...config,
  }

  // 1. Create game
  const { state, rng } = createGame({ seed })

  // 2. Start player
  startPlayer(state, PLAYER_ID, rng)

  // 3. Create metrics collector
  const collector = createMetricsCollector(PLAYER_ID)

  // Agent context (persists across ticks)
  const context: AgentContext = {
    rng,
    memory: {},
    executor,
  }

  let distanceTraveled = 0
  let episodeReward = 0
  let prevLat: number | null = null
  let prevLng: number | null = null

  // 4. Game loop
  for (let tick = 0; tick < maxTicks; tick++) {
    if (state.endedAt != null) break

    // Track ship position before step for distance
    const player = state.players.get(PLAYER_ID)
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
    } else {
      // Ship dead or missing — reset tracking
      prevLat = null
      prevLng = null
    }

    // Track bullet count before step to detect new shots
    const bulletsBefore = state.bullets.size

    const rockSignals =
      ship?.alive === true
        ? rockRewardSignals(state, ship.lat, ship.lng, ship.yaw)
        : { alignment: 0, offActionDistance: 0 }

    // Get agent inputs
    const inputs = agent(state, PLAYER_ID, context)

    // Step the simulation
    step(state, { [PLAYER_ID]: inputs }, dtMs, rng, collector.hooks)

    // Track new bullets fired
    const newBullets = state.bullets.size - bulletsBefore
    if (newBullets > 0) {
      collector.addShotsFired(newBullets)
    }

    const frameEvents = collector.consumeFrameEvents()
    let frameReward = -FRAME_IDLE_PENALTY
    frameReward -= newBullets * FIRE_PENALTY
    frameReward += frameEvents.rocksDestroyed * ROCK_DESTROY_REWARD
    frameReward -= frameEvents.deaths * DEATH_PENALTY
    if (rockSignals.alignment > ALIGNMENT_THRESHOLD) {
      frameReward += rockSignals.alignment * ALIGNMENT_REWARD_SCALE
    }

    const playerNow = state.players.get(PLAYER_ID)
    const shipNow =
      playerNow?.shipId != null ? state.ships.get(playerNow.shipId) : undefined
    if (shipNow?.alive === true) {
      if (rockSignals.offActionDistance > OFF_ACTION_THRESHOLD) {
        frameReward -= OFF_ACTION_PENALTY
      }
      if (shipNow.angularVelocity.length() > HIGH_SPEED_THRESHOLD) {
        frameReward -= HIGH_SPEED_PENALTY
      }
    }
    episodeReward += frameReward

    // Update prevDistances for approach speed tracking (used by neatAgent encoding)
    const playerAfter = state.players.get(PLAYER_ID)
    const shipAfter =
      playerAfter?.shipId != null
        ? state.ships.get(playerAfter.shipId)
        : undefined
    if (shipAfter?.alive) {
      const prevDistances = context.memory[MEMORY_PREV_DISTANCES] as
        | Map<string, number>
        | undefined
      if (prevDistances != null) {
        for (const rock of state.rocks.values()) {
          const dist = greatCircleDistance(
            shipAfter.lat,
            shipAfter.lng,
            rock.lat,
            rock.lng,
            RADIUS
          )
          prevDistances.set(`rock:${rock.id}`, dist)
        }
        for (const bullet of state.bullets.values()) {
          const dist = greatCircleDistance(
            shipAfter.lat,
            shipAfter.lng,
            bullet.lat,
            bullet.lng,
            RADIUS
          )
          prevDistances.set(`bullet:${bullet.id}`, dist)
        }
        // Remove destroyed rocks
        for (const id of prevDistances.keys()) {
          const [entityType, entityId] = id.split(':')
          if (
            (entityType === 'rock' && !state.rocks.has(entityId ?? '')) ||
            (entityType === 'bullet' && !state.bullets.has(entityId ?? ''))
          ) {
            prevDistances.delete(id)
          }
        }
      }
    }

    // Store dtMs for encoding approach speed calculation
    context.memory[MEMORY_LAST_DT_MS] = dtMs
  }

  // Final distance update
  const player = state.players.get(PLAYER_ID)
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
  return collector.getMetrics({
    episodeReward,
    score: player?.score ?? 0,
    livesRemaining: player?.lives ?? 0,
    timeAlive: state.now,
    distanceTraveled,
    wavesSpawned: state.wave,
  })
}
