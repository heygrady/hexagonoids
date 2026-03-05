import type { EngineHooks } from '@heygrady/hexagonoids-engine'

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
 */
export function createMetricsCollector(playerId: string): MetricsCollector {
  let shotsHit = 0
  let rocksDestroyed = 0
  let deaths = 0
  let shotsFired = 0

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
    onCollision: (_a, _b, type) => {
      if (type === 'bullet-rock') {
        // shotsHit and rocksDestroyed are always equal in Phase 02a: one bullet
        // destroys exactly one rock per collision. Child rocks from splits are
        // not counted here. Split into separate trackers in Phase 02b if needed.
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
