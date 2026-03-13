import {
  createGame,
  type PlayerInputs,
  RADIUS,
  ROCK_WAVE_SIZES,
  startPlayer,
} from '@heygrady/hexagonoids-engine'
import type {
  EpisodeInfo,
  EpisodeResult,
  TransitionInfo,
} from '@neat-evolution/environment'

import type { AgentContext, AgentFn, SyncExecutor } from '../agents/types.js'
import { MEMORY_ROCK_PERCEPTION } from '../agents/types.js'
import { buildRockPerceptionPrecompute } from '../encoding/collectObservations.js'
import {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  type SimulationConfig,
} from '../HexagonoidsEnvironmentConfig.js'
import { yawToBearing } from '../utils/sphericalBearing.js'
import type { EpisodeAgentBridge } from './EpisodeAgentBridge.js'
import { findBucketXYZ } from './icosahedralBuckets.js'
import type { RawMetrics } from './RawMetrics.js'
import { createMetricsCollector } from './RawMetrics.js'

export interface RewardConfig {
  survivalReward: number
  scoreScale: number
  shotPenalty: number
  deathPenalty: number
  waveBonus: number
}

export const DEFAULT_REWARD_CONFIG: RewardConfig = {
  survivalReward: 0.005,
  scoreScale: 0.001,
  shotPenalty: 0.002,
  deathPenalty: -1,
  waveBonus: 0.05,
}

export interface SimulationEpisodeRuntime {
  controller?: EpisodeAgentBridge
  episodeInfo?: EpisodeInfo
  situationClass?: number | undefined
  rewardConfig?: RewardConfig
  metadata?: Record<string, unknown>
  onEpisodeComplete?: (
    metrics: RawMetrics,
    context: { steps: number; terminated: boolean }
  ) => number
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
  executor?: SyncExecutor,
  runtime?: SimulationEpisodeRuntime
): RawMetrics {
  const { maxTicks, dtMs, useFastThrust } = {
    ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation,
    ...config,
  }
  const rewardConfig = runtime?.rewardConfig ?? DEFAULT_REWARD_CONFIG
  const controller = runtime?.controller
  const episodeInfo: EpisodeInfo =
    runtime?.episodeInfo ??
    ({
      episodeIndex: 0,
      type: 'full-game',
    } as const)
  const episodeMetadata = runtime?.metadata ?? { seed }
  if (controller) {
    controller.startEpisode(episodeInfo)
  }

  // 1. Create game
  const engine = createGame({ seed, useFastThrust })
  const { state, rng } = engine

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
  const visitedBuckets = new Set<number>()
  let prevScore = trackedPlayer?.score ?? 0
  let prevLives = trackedPlayer?.lives ?? 0

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
        collector.addRocksSeen(visibleIds)
        collector.addFrameWithRocksInSOI()
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

    // Reward + metadata plumbing for RL agents
    const livePlayer = trackedPlayer ?? state.players.get(PLAYER_ID)
    const liveShip =
      livePlayer?.shipId != null
        ? state.ships.get(livePlayer.shipId)
        : undefined
    const scoreNow = livePlayer?.score ?? prevScore
    const scoreDelta = scoreNow - prevScore
    prevScore = scoreNow
    const livesNow = livePlayer?.lives ?? prevLives
    const lifeDelta = livesNow - prevLives
    prevLives = livesNow
    const waveChanged = state.wave > waveBefore

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
    if (waveChanged) {
      reward += rewardConfig.waveBonus
    }

    const transitionInfo: TransitionInfo = {}
    if (runtime?.situationClass != null) {
      transitionInfo.situationClass = runtime.situationClass
    }
    if (scoreDelta > 0 || lifeDelta < 0 || waveChanged) {
      transitionInfo.isInteresting = true
    }

    const isFinalStep =
      state.endedAt != null || tick >= maxTicks - 1 || livesNow <= 0
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
    score: player?.score ?? 0,
    livesRemaining: player?.lives ?? 0,
    timeAlive: state.now,
    distanceTraveled,
    wavesSpawned: state.wave,
    elapsedTicks: tick,
  })

  const terminated =
    (player?.lives ?? 0) <= 0 ||
    (state.endedAt != null && player?.alive === false)
  const fitness =
    runtime?.onEpisodeComplete?.(metrics, {
      steps: tick,
      terminated,
    }) ?? 0

  if (controller) {
    const episodeResult: EpisodeResult = {
      fitness,
      totalSteps: tick,
      terminated,
      metadata: episodeMetadata,
    }
    controller.endEpisode(episodeResult)
  }

  return metrics
}
