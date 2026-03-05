import type { EngineHooks, GameState } from '@heygrady/hexagonoids-engine'

export interface RawMetrics {
  score: number
  livesRemaining: number
  timeAlive: number
  accuracy: number
  distanceTraveled: number
  rocksDestroyed: number
  shotsFired: number
  shotsHit: number
  deaths: number
  wavesSpawned: number
  // Phase 05 action & engagement metrics
  thrustFrames: number
  fireFrames: number
  leftFrames: number
  rightFrames: number
  aliveFrames: number
  largeRocksSpawned: number
  uniqueRocksSeen: number
  framesWithRocksInSOI: number
  uniqueCellsVisited: number
  elapsedTicks: number
}

export interface MetricsCollector {
  hooks: EngineHooks
  /** Call when bullets are spawned (simulation loop tracks bullet count). */
  addShotsFired: (count: number) => void
  /** Increment action counters per live frame. */
  addActionFrame: (
    inputs: { thrust: boolean; fire: boolean; left: boolean; right: boolean },
    alive: boolean
  ) => void
  /** Track large rocks spawned from a wave. */
  addLargeRocksSpawned: (count: number) => void
  /** Track unique rocks the agent has observed. */
  addRocksSeen: (rockIds: string[]) => void
  /** Increment counter for frames where rocks are within SOI. */
  addFrameWithRocksInSOI: () => void
  /** Set unique cells visited from external bucket tracking. */
  setUniqueCellsVisited: (count: number) => void
  /** Score earned by pre-scenario bullets (to subtract from score delta). */
  getPreScenarioScore: () => number
  /** Finalize and return metrics. */
  getMetrics: (final: {
    score: number
    livesRemaining: number
    timeAlive: number
    distanceTraveled: number
    wavesSpawned: number
    elapsedTicks: number
  }) => RawMetrics
}

/**
 * Create a metrics collector that uses EngineHooks to track game events.
 *
 * Tracked via hooks:
 * - shotsHit / rocksDestroyed: bullet-rock collisions
 * - deaths: onPlayerDied
 *
 * Tracked by simulation loop:
 * - shotsFired: via addShotsFired (bullet count delta each tick)
 * - score, livesRemaining, timeAlive, distanceTraveled, wavesSpawned
 *
 * @param playerId - The player whose metrics to track.
 * @param state - Optional game state for looking up bullet/rock data.
 * @param bulletFiredCutoff - If set, bullet-rock collisions where the bullet's
 *   firedAt < cutoff are excluded from shotsHit/rocksDestroyed and their score
 *   is tracked separately via getPreScenarioScore().
 */
export function createMetricsCollector(
  playerId: string,
  state?: GameState,
  bulletFiredCutoff?: number
): MetricsCollector {
  let shotsHit = 0
  let rocksDestroyed = 0
  let deaths = 0
  let shotsFired = 0
  let preScenarioScore = 0

  // Phase 05 tracking state
  let thrustFrames = 0
  let fireFrames = 0
  let leftFrames = 0
  let rightFrames = 0
  let aliveFrames = 0
  let largeRocksSpawned = 0
  let framesWithRocksInSOI = 0
  let uniqueCellsVisited = 0
  const uniqueRocksSeen = new Set<string>()

  const hooks: EngineHooks = {
    onCollision: (a, b, type) => {
      if (type === 'bullet-rock') {
        // Check if this bullet was fired before the scenario started
        if (bulletFiredCutoff != null && state != null) {
          const bullet = state.bullets.get(a.id)
          if (
            bullet != null &&
            bullet.firedAt != null &&
            bullet.firedAt < bulletFiredCutoff
          ) {
            // Pre-scenario bullet — track score but don't count in metrics
            const rock = state.rocks.get(b.id)
            if (rock != null) {
              preScenarioScore += rock.value
            }
            return
          }
        }
        shotsHit++
        rocksDestroyed++
      }
    },
    onPlayerDied: (diedPlayerId) => {
      if (diedPlayerId === playerId) {
        deaths++
      }
    },
  }

  return {
    hooks,
    addShotsFired: (count: number) => {
      shotsFired += count
    },
    addActionFrame: (inputs, alive) => {
      if (!alive) return
      aliveFrames++
      if (inputs.thrust) thrustFrames++
      if (inputs.fire) fireFrames++
      if (inputs.left) leftFrames++
      if (inputs.right) rightFrames++
    },
    addLargeRocksSpawned: (count: number) => {
      largeRocksSpawned += count
    },
    addRocksSeen: (rockIds: string[]) => {
      for (const id of rockIds) {
        uniqueRocksSeen.add(id)
      }
    },
    addFrameWithRocksInSOI: () => {
      framesWithRocksInSOI++
    },
    setUniqueCellsVisited: (count: number) => {
      uniqueCellsVisited = count
    },
    getPreScenarioScore: () => preScenarioScore,
    getMetrics: (final) => ({
      score: final.score,
      livesRemaining: final.livesRemaining,
      timeAlive: final.timeAlive,
      accuracy: shotsFired > 0 ? shotsHit / shotsFired : 0,
      distanceTraveled: final.distanceTraveled,
      rocksDestroyed,
      shotsFired,
      shotsHit,
      deaths,
      wavesSpawned: final.wavesSpawned,
      thrustFrames,
      fireFrames,
      leftFrames,
      rightFrames,
      aliveFrames,
      largeRocksSpawned,
      uniqueRocksSeen: uniqueRocksSeen.size,
      framesWithRocksInSOI,
      uniqueCellsVisited,
      elapsedTicks: final.elapsedTicks,
    }),
  }
}
