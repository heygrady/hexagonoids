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
}

export interface MetricsCollector {
  hooks: EngineHooks
  /** Call when bullets are spawned (simulation loop tracks bullet count). */
  addShotsFired: (count: number) => void
  /** Finalize and return metrics. */
  getMetrics: (final: {
    score: number
    livesRemaining: number
    timeAlive: number
    distanceTraveled: number
    wavesSpawned: number
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
    }),
  }
}
