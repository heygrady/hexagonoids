import {
  type PlayerInputs,
  RADIUS,
  ROCK_WAVE_SIZES,
} from '@heygrady/hexagonoids-engine'
import type {
  EpisodeInfo,
  EpisodeResult,
  TransitionInfo,
} from '@neat-evolution/environment'
import { createRNG } from '@neat-evolution/utils'

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
import {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  type SimulationConfig,
} from '../HexagonoidsEnvironmentConfig.js'
import { yawToBearing } from '../utils/sphericalBearing.js'

import { restoreSnapshot } from './restoreSnapshot.js'
import type { ScenarioSnapshot } from './types.js'

const PLAYER_ID = 'player-1'
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
  executor?: SyncExecutor,
  runtime?: SimulationEpisodeRuntime
): RawMetrics {
  const { maxTicks, dtMs } = {
    ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation,
    ...config,
  }
  const rewardConfig = runtime?.rewardConfig ?? DEFAULT_REWARD_CONFIG
  const controller: EpisodeAgentBridge | undefined = runtime?.controller
  const episodeInfo: EpisodeInfo =
    runtime?.episodeInfo ??
    ({
      episodeIndex: 0,
      type: 'scenario',
    } as const)
  const episodeMetadata = runtime?.metadata ?? {
    seed,
    scenarioId: scenario.id,
  }
  if (controller) {
    controller.startEpisode(episodeInfo)
  }

  // 1. Restore game from snapshot
  const engine = restoreSnapshot(scenario, seed)
  const { state, rng } = engine

  // Apply ship jitter if configured
  const jitterYaw = config.scenarioJitterYaw ?? 0
  const jitterSpeed = config.scenarioJitterSpeed ?? 0

  if (jitterYaw > 0 || jitterSpeed > 0) {
    const jitterRng = createRNG(`${seed}:jitter:${scenario.id}`)
    const jitterShip = state.ships.values().next().value
    if (jitterShip != null) {
      if (jitterYaw > 0) {
        jitterShip.yaw += (jitterRng.gen() * 2 - 1) * jitterYaw
      }
      if (jitterSpeed > 0) {
        const factor = 1 + (jitterRng.gen() * 2 - 1) * jitterSpeed
        jitterShip.angularVelocity.scaleInPlace(factor)
      }
    }
  }

  // Capture baselines for delta metrics
  const baselineGameTime = state.now
  const baselineScore = scenario.player.score
  const baselineWave = state.wave
  const trackedPlayer = state.players.get(PLAYER_ID)

  // 3. Create metrics collector with bullet cutoff at scenario start time
  const collector = createMetricsCollector(PLAYER_ID, state, state.now)

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

  // 4. Game loop
  let tick = 0
  for (; tick < maxTicks; tick++) {
    if (state.endedAt != null) break

    // Track ship position before step for distance + spatial coverage
    const player = trackedPlayer ?? state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship?.alive) {
      const cx = ship.x
      const cy = ship.y
      const cz = ship.z

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
        ? buildRockPerceptionPrecompute(ship, yawToBearing(ship.yaw), engine)
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
      tick >= maxTicks - 1 ||
      state.wave > baselineWave + 1 ||
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
  const player = trackedPlayer ?? state.players.get(PLAYER_ID)
  const ship =
    player?.shipId != null ? state.ships.get(player.shipId) : undefined
  if (ship?.alive && hasPrev) {
    const dx = ship.x - prevX
    const dy = ship.y - prevY
    const dz = ship.z - prevZ
    distanceTraveled += Math.sqrt(dx * dx + dy * dy + dz * dz) * RADIUS
  }

  // 7. Return collected metrics
  collector.setUniqueCellsVisited(visitedBuckets.size)

  const metrics = collector.getMetrics({
    score:
      (player?.score ?? 0) - baselineScore - collector.getPreScenarioScore(),
    livesRemaining: player?.lives ?? 0,
    timeAlive: state.now - baselineGameTime,
    distanceTraveled,
    wavesSpawned: state.wave - baselineWave,
    elapsedTicks: tick,
  })

  const terminated =
    (player?.lives ?? 0) <= 0 ||
    (state.endedAt != null && player?.alive === false)
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
