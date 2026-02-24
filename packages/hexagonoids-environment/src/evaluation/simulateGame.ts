import {
  createGame,
  greatCircleDistance,
  RADIUS,
  startPlayer,
  step,
} from '@heygrady/hexagonoids-engine'

import type { AgentContext, AgentFn, SyncExecutor } from '../agents/types.js'
import type { RawMetrics } from './RawMetrics.js'
import { createMetricsCollector } from './RawMetrics.js'

export interface SimulationConfig {
  maxTicks: number
  dtMs: number
}

const DEFAULT_CONFIG: SimulationConfig = {
  maxTicks: 3000,
  dtMs: 33,
}

const PLAYER_ID = 'player-1'

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
  const { maxTicks, dtMs } = { ...DEFAULT_CONFIG, ...config }

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

    // Get agent inputs
    const inputs = agent(state, PLAYER_ID, context)

    // Step the simulation
    step(state, { [PLAYER_ID]: inputs }, dtMs, rng, collector.hooks)

    // Track new bullets fired
    const newBullets = state.bullets.size - bulletsBefore
    if (newBullets > 0) {
      collector.addShotsFired(newBullets)
    }
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
    score: player?.score ?? 0,
    livesRemaining: player?.lives ?? 0,
    timeAlive: state.now,
    distanceTraveled,
    wavesSpawned: state.wave,
  })
}
