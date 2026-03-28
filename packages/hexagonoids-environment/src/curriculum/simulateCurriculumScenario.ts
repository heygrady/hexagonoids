import { type PlayerInputs, RADIUS } from '@heygrady/hexagonoids-engine'
import { createRNG } from '@neat-evolution/utils'

import type { AgentContext, AgentFn } from '../agents/types.js'
import {
  MEMORY_ACTION_DIAGNOSTICS,
  MEMORY_ROCK_PERCEPTION,
  MEMORY_SEEN_ROCKS,
} from '../agents/types.js'
import { buildRockPerceptionPrecompute } from '../encoding/collectObservations.js'
import { findBucketXYZ } from '../evaluation/icosahedralBuckets.js'
import type { RawMetrics } from '../evaluation/RawMetrics.js'
import { createMetricsCollector } from '../evaluation/RawMetrics.js'
import type { SimulationHooks } from '../evaluation/simulateGame.js'
import {
  detectTurnConflict,
  normalizeExclusiveTurnInput,
  type TurnInputDiagnostics,
} from '../evaluation/turnInputs.js'
import { yawToBearing } from '../utils/sphericalBearing.js'

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
  hooks?: SimulationHooks
): RawMetrics {
  const { engine, maxTicks } = createCurriculumGameState(params, seed, dtMs)
  const { state, rng } = engine

  // Apply ship yaw jitter and random left/right mirror (same as simulateScenario)
  const jitterYaw = Math.PI / 12 // ~15 degrees
  const jitterRng = createRNG(seed).derive('jitter')
  const jitterShip = state.ships.values().next().value

  if (jitterShip != null) {
    // ±15° yaw jitter
    if (jitterYaw > 0) {
      jitterShip.yaw += (jitterRng.gen() * 2 - 1) * jitterYaw
    }

    // 50% chance to mirror the scenario left/right relative to the ship.
    if (jitterRng.genBool()) {
      const cx = jitterShip.position[0]
      const cy = jitterShip.position[1]
      const cz = jitterShip.position[2]

      // Build local basis at ship position (same as perception system)
      const refY = Math.abs(cy) > 0.99 ? 0 : 1
      const refZ = Math.abs(cy) > 0.99 ? 1 : 0
      let eastX = refY * cz - refZ * cy
      let eastY = refZ * cx - 0 * cz
      let eastZ = 0 * cy - refY * cx
      const eastLen = Math.sqrt(eastX * eastX + eastY * eastY + eastZ * eastZ)
      if (eastLen > 1e-9) {
        const inv = 1 / eastLen
        eastX *= inv
        eastY *= inv
        eastZ *= inv
      }
      const northX = eastY * cz - eastZ * cy
      const northY = eastZ * cx - eastX * cz
      const northZ = eastX * cy - eastY * cx

      // Ship's right vector in tangent plane from bearing
      const bearing = yawToBearing(jitterShip.yaw)
      const cosB = Math.cos(bearing)
      const sinB = Math.sin(bearing)
      const mirrorRx = -sinB * northX + cosB * eastX
      const mirrorRy = -sinB * northY + cosB * eastY
      const mirrorRz = -sinB * northZ + cosB * eastZ

      // Reflect positions and velocities across the plane with normal = right
      for (const rock of state.rocks.values()) {
        const p = rock.position
        const d = 2 * (p[0] * mirrorRx + p[1] * mirrorRy + p[2] * mirrorRz)
        p[0] -= d * mirrorRx
        p[1] -= d * mirrorRy
        p[2] -= d * mirrorRz
        const v = rock.angularVelocity
        const vd = 2 * (v[0] * mirrorRx + v[1] * mirrorRy + v[2] * mirrorRz)
        v[0] -= vd * mirrorRx
        v[1] -= vd * mirrorRy
        v[2] -= vd * mirrorRz
      }
    }
  }

  // Capture baselines
  const baselineGameTime = state.now
  const trackedPlayer = state.players.get(PLAYER_ID)
  const baselineScore = trackedPlayer?.score ?? 0

  // Create metrics collector (same as simulateScenario)
  const collector = createMetricsCollector(PLAYER_ID)

  const memory: AgentContext['memory'] = {}
  const context: AgentContext = {
    rng,
    memory,
    spatialQueries: engine,
  }

  const defaultInput = { left: false, right: false, thrust: false, fire: false }
  const stepInputs: PlayerInputs = { [PLAYER_ID]: defaultInput }

  let hasSeenRock = false
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
  let prevScore = 0
  let prevLives = trackedPlayer?.lives ?? 0

  let tick = 0
  for (; tick < maxTicks; tick++) {
    if (state.endedAt != null) break

    // Early stop conditions checked before act() — these are safe because
    // no step is open yet at the top of the loop.
    if (state.rocks.size === 0) break
    if (trackedPlayer != null && !trackedPlayer.alive) break

    const ship =
      trackedPlayer?.shipId != null
        ? state.ships.get(trackedPlayer.shipId)
        : undefined

    // Track ship position for distance + spatial coverage
    if (ship?.alive) {
      const cx = ship.position[0]
      const cy = ship.position[1]
      const cz = ship.position[2]

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
            ship.position,
            yawToBearing(ship.yaw),
            engine
          )
        : undefined
    memory[MEMORY_ROCK_PERCEPTION] = rockPerception

    // Get agent inputs
    const rawInputs = agent(state, PLAYER_ID, context)
    const diagnostics = context.memory[
      MEMORY_ACTION_DIAGNOSTICS
    ] as TurnInputDiagnostics | undefined
    const turnConflict =
      diagnostics?.turnConflict === true || detectTurnConflict(rawInputs)
    const turnAmbiguous = diagnostics?.turnAmbiguous === true
    const inputs = normalizeExclusiveTurnInput(rawInputs)

    // Track action usage per live frame
    collector.addActionFrame(inputs, ship?.alive === true, {
      turnConflict,
      turnAmbiguous,
    })

    // Track rocks in SOI and unique rocks seen
    if (rockPerception != null && rockPerception.rocks.length > 0) {
      const visibleIds: string[] = []
      for (const entry of rockPerception.rocks) {
        if (entry.inVisionRange) {
          visibleIds.push(entry.id)
        }
      }
      if (visibleIds.length > 0) {
        hasSeenRock = true
        collector.addRocksSeen(visibleIds)
        collector.addFrameWithRocksInSOI()
      }
    }

    // Early stop: agent previously saw rocks but now has zero known rocks.
    // Deferred to after the tick so the step agent's act→completeStep cycle
    // finishes before the episode ends.
    let earlyStop = false
    if (hasSeenRock && ship?.alive) {
      const hasVisibleRocks =
        rockPerception != null &&
        rockPerception.rocks.some((r) => r.inVisionRange)
      if (!hasVisibleRocks) {
        const seenRocks = context.memory[MEMORY_SEEN_ROCKS] as
          | Set<string>
          | undefined
        if (seenRocks == null || seenRocks.size === 0) earlyStop = true
      }
    }

    stepInputs[PLAYER_ID] = inputs
    engine.tick(stepInputs, dtMs, collector.hooks)

    // Track new bullets fired
    const newBullets = state.bullets.size - bulletsBefore
    if (newBullets > 0) {
      collector.addShotsFired(newBullets)
    }

    // Compute tick deltas for hooks
    const livePlayer = trackedPlayer ?? state.players.get(PLAYER_ID)
    const liveShip =
      livePlayer?.shipId != null
        ? state.ships.get(livePlayer.shipId)
        : undefined
    const scoreNow = (livePlayer?.score ?? 0) - baselineScore
    const scoreDelta = scoreNow - prevScore
    prevScore = scoreNow
    const livesNow = livePlayer?.lives ?? prevLives
    const lifeDelta = livesNow - prevLives
    prevLives = livesNow

    const terminated =
      livesNow <= 0 || (state.endedAt != null && livePlayer?.alive === false)
    const truncated =
      earlyStop || state.rocks.size === 0 || tick >= maxTicks - 1

    const tickRocks = collector.getTickRocksDestroyed()

    if (hooks?.onAfterTick != null) {
      hooks.onAfterTick(
        {
          tick,
          scoreDelta,
          lifeDelta,
          rocksDestroyed: tickRocks,
          waveChanged: false, // Curriculum scenarios suppress waves
          newBullets,
          shipAlive: liveShip?.alive === true,
          terminated,
          truncated,
          thrustActive: inputs.thrust,
        },
        {
          state,
          playerId: PLAYER_ID,
          inputs,
          rawInputs,
          turnConflict,
          turnAmbiguous,
          context,
        }
      )
    }

    if (earlyStop) break
  }

  // Final distance update
  const ship =
    trackedPlayer?.shipId != null
      ? state.ships.get(trackedPlayer.shipId)
      : undefined
  if (ship?.alive && hasPrev) {
    const dx = ship.position[0] - prevX
    const dy = ship.position[1] - prevY
    const dz = ship.position[2] - prevZ
    distanceTraveled += Math.sqrt(dx * dx + dy * dy + dz * dz) * RADIUS
  }
  collector.setUniqueCellsVisited(visitedBuckets.size)

  return collector.getMetrics({
    score: (trackedPlayer?.score ?? 0) - baselineScore,
    livesRemaining: trackedPlayer?.lives ?? 0,
    timeAlive: state.now - baselineGameTime,
    distanceTraveled,
    wavesSpawned: 0, // Curriculum scenarios suppress waves
    elapsedTicks: tick,
  })
}
