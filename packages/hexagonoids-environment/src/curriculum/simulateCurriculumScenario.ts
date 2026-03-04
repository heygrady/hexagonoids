import { type PlayerInputs, RADIUS } from '@heygrady/hexagonoids-engine'

import type { AgentContext, AgentFn, SyncExecutor } from '../agents/types.js'
import {
  MEMORY_LAST_DT_MS,
  MEMORY_PREV_DISTANCES,
  MEMORY_PREV_PROJECTIONS,
  MEMORY_ROCK_PERCEPTION,
} from '../agents/types.js'
import { buildRockPerceptionPrecompute } from '../encoding/collectObservations.js'
import { updatePrevDistances } from '../encoding/updatePrevDistances.js'
import { findBucketXYZ } from '../evaluation/icosahedralBuckets.js'
import type { RawMetrics } from '../evaluation/RawMetrics.js'
import { createMetricsCollector } from '../evaluation/RawMetrics.js'

import type { CurriculumScenarioParams } from './generateCurriculumScenario.js'
import { createCurriculumGameState } from './generateCurriculumScenario.js'

const PLAYER_ID = 'player-1'

/**
 * Run a single curriculum micro-scenario and collect full metrics.
 * Uses the same MetricsCollector pattern as simulateScenario for consistent
 * scoring via weightedFitnessSum.
 */
export function simulateCurriculumScenario(
  agent: AgentFn,
  params: CurriculumScenarioParams,
  seed: string,
  dtMs: number,
  executor?: SyncExecutor
): RawMetrics {
  const { engine, maxTicks } = createCurriculumGameState(params, seed, dtMs)
  const { state, rng } = engine

  // Capture baselines
  const baselineGameTime = state.now
  const trackedPlayer = state.players.get(PLAYER_ID)
  const baselineScore = trackedPlayer?.score ?? 0

  // Create metrics collector (same as simulateScenario)
  const collector = createMetricsCollector(PLAYER_ID)

  const context: AgentContext = {
    rng,
    memory: {},
    executor,
    spatialQueries: engine,
  }

  const stepInputs: PlayerInputs = {
    [PLAYER_ID]: { left: false, right: false, thrust: false, fire: false },
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
  const visitedBuckets = new Set<number>()

  for (let tick = 0; tick < maxTicks; tick++) {
    if (state.endedAt != null) break

    // Early stop: all rocks destroyed or player died
    if (state.rocks.size === 0) break
    const earlyPlayer = state.players.get(PLAYER_ID)
    if (earlyPlayer != null && !earlyPlayer.alive) break

    const player = trackedPlayer ?? state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined

    // Track ship position for distance + spatial coverage
    if (ship?.alive) {
      const cx = ship.x ?? 0
      const cy = ship.y ?? 1
      const cz = ship.z ?? 0

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

      // Spatial coverage bucket tracking
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
      hasPrev = false
    }

    // Track bullet count before step
    const bulletsBefore = state.bullets.size

    // Build rock perception
    const rockPerception =
      ship?.alive === true
        ? buildRockPerceptionPrecompute(
            { x: ship.x ?? 0, y: ship.y ?? 1, z: ship.z ?? 0 },
            Math.PI / 2 + ship.yaw,
            engine
          )
        : undefined
    context.memory[MEMORY_ROCK_PERCEPTION] = rockPerception

    // Get agent inputs
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

    // Update prevDistances before step
    if (ship?.alive) {
      const prevDistances = context.memory[MEMORY_PREV_DISTANCES] as
        | Map<string, number>
        | undefined
      if (prevDistances != null) {
        const prevProjections = context.memory[MEMORY_PREV_PROJECTIONS] as
          | Map<string, [number, number]>
          | undefined
        updatePrevDistances(
          state,
          tick,
          rockPerception,
          prevDistances,
          prevProjections
        )
      }
    }

    context.memory[MEMORY_LAST_DT_MS] = dtMs

    stepInputs[PLAYER_ID] = inputs
    engine.tick(stepInputs, dtMs, collector.hooks)

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
    const fx = ship.x ?? 0
    const fy = ship.y ?? 1
    const fz = ship.z ?? 0
    const dx = fx - prevX
    const dy = fy - prevY
    const dz = fz - prevZ
    distanceTraveled += Math.sqrt(dx * dx + dy * dy + dz * dz) * RADIUS
  }

  collector.setUniqueCellsVisited(visitedBuckets.size)

  return collector.getMetrics({
    episodeReward: 0,
    score: (player?.score ?? 0) - baselineScore,
    livesRemaining: player?.lives ?? 0,
    timeAlive: state.now - baselineGameTime,
    distanceTraveled,
    wavesSpawned: 0, // Curriculum scenarios suppress waves
  })
}
