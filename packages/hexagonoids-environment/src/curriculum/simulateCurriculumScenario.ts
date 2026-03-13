import { type PlayerInputs, RADIUS } from '@heygrady/hexagonoids-engine'
import type {
  EpisodeInfo,
  EpisodeResult,
  TransitionInfo,
} from '@neat-evolution/environment'

import type { AgentContext, AgentFn, SyncExecutor } from '../agents/types.js'
import { MEMORY_ROCK_PERCEPTION, MEMORY_SEEN_ROCKS } from '../agents/types.js'
import { buildRockPerceptionPrecompute } from '../encoding/collectObservations.js'
import type { EpisodeAgentBridge } from '../evaluation/EpisodeAgentBridge.js'
import { findBucketXYZ } from '../evaluation/icosahedralBuckets.js'
import type { RawMetrics } from '../evaluation/RawMetrics.js'
import { createMetricsCollector } from '../evaluation/RawMetrics.js'
import {
  DEFAULT_REWARD_CONFIG,
  type SimulationEpisodeRuntime,
} from '../evaluation/simulateGame.js'
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
  executor?: SyncExecutor,
  runtime?: SimulationEpisodeRuntime
): RawMetrics {
  const { engine, maxTicks } = createCurriculumGameState(params, seed, dtMs)
  const { state, rng } = engine
  const rewardConfig = runtime?.rewardConfig ?? DEFAULT_REWARD_CONFIG
  const controller: EpisodeAgentBridge | undefined = runtime?.controller
  const episodeInfo: EpisodeInfo =
    runtime?.episodeInfo ??
    ({
      episodeIndex: 0,
      type: 'curriculum',
    } as const)
  const episodeMetadata =
    runtime?.metadata ??
    ({ seed, coneIndex: params.coneIndex } as Record<string, unknown>)
  if (controller) {
    controller.startEpisode(episodeInfo)
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
    executor,
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
  let episodeReturn = 0

  let tick = 0
  for (; tick < maxTicks; tick++) {
    if (state.endedAt != null) break

    // Early stop: all rocks destroyed or player died
    if (state.rocks.size === 0) break
    if (trackedPlayer != null && !trackedPlayer.alive) break

    const ship =
      trackedPlayer?.shipId != null
        ? state.ships.get(trackedPlayer.shipId)
        : undefined

    // Track ship position for distance + spatial coverage
    if (ship?.alive) {
      const cx = ship.x
      const cy = ship.y
      const cz = ship.z

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
        ? buildRockPerceptionPrecompute(ship, yawToBearing(ship.yaw), engine)
        : undefined
    memory[MEMORY_ROCK_PERCEPTION] = rockPerception

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
        hasSeenRock = true
        collector.addRocksSeen(visibleIds)
        collector.addFrameWithRocksInSOI()
      }
    }

    // Early stop: agent previously saw rocks but now has zero known rocks
    if (hasSeenRock && ship?.alive) {
      const hasVisibleRocks =
        rockPerception != null &&
        rockPerception.rocks.some((r) => r.inVisionRange)
      if (!hasVisibleRocks) {
        const seenRocks = context.memory[MEMORY_SEEN_ROCKS] as
          | Set<string>
          | undefined
        if (seenRocks == null || seenRocks.size === 0) break
      }
    }

    stepInputs[PLAYER_ID] = inputs
    engine.tick(stepInputs, dtMs, collector.hooks)

    // Track new bullets fired
    const newBullets = state.bullets.size - bulletsBefore
    if (newBullets > 0) {
      collector.addShotsFired(newBullets)
    }

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

    let reward = 0
    if (liveShip?.alive) {
      reward += rewardConfig.survivalReward
    }
    if (scoreDelta !== 0) {
      reward += scoreDelta * rewardConfig.scoreScale
    }
    if (lifeDelta < 0) {
      reward += rewardConfig.deathPenalty * Math.abs(lifeDelta)
    }
    if (newBullets > 0) {
      reward -= newBullets * rewardConfig.shotPenalty
    }
    episodeReturn += reward

    const transitionInfo: TransitionInfo = {}
    if (runtime?.situationClass != null) {
      transitionInfo.situationClass = runtime.situationClass
    }
    if (scoreDelta > 0 || lifeDelta < 0) {
      transitionInfo.isInteresting = true
    }

    const isFinalStep =
      state.endedAt != null ||
      state.rocks.size === 0 ||
      tick >= maxTicks - 1 ||
      livesNow <= 0
    if (controller) {
      if (
        transitionInfo.isInteresting ||
        transitionInfo.situationClass != null
      ) {
        controller.transitionInfo(transitionInfo)
      }
      controller.reward(reward, isFinalStep)
    }
  }

  // Final distance update
  const ship =
    trackedPlayer?.shipId != null
      ? state.ships.get(trackedPlayer.shipId)
      : undefined
  if (ship?.alive && hasPrev) {
    const dx = ship.x - prevX
    const dy = ship.y - prevY
    const dz = ship.z - prevZ
    distanceTraveled += Math.sqrt(dx * dx + dy * dy + dz * dz) * RADIUS
  }
  collector.setUniqueCellsVisited(visitedBuckets.size)

  const metrics = collector.getMetrics({
    score: (trackedPlayer?.score ?? 0) - baselineScore,
    livesRemaining: trackedPlayer?.lives ?? 0,
    timeAlive: state.now - baselineGameTime,
    distanceTraveled,
    wavesSpawned: 0, // Curriculum scenarios suppress waves
    elapsedTicks: tick,
  })

  const terminated =
    (trackedPlayer?.lives ?? 0) <= 0 ||
    (state.endedAt != null && trackedPlayer?.alive === false)
  const episodeResult: EpisodeResult = {
    fitness:
      runtime?.onEpisodeComplete?.(metrics, {
        steps: tick,
        terminated,
      }) ?? 0,
    episodeReturn,
    totalSteps: tick,
    terminated,
    metadata: episodeMetadata,
  }
  if (controller) {
    controller.endEpisode(episodeResult)
  }

  return metrics
}
