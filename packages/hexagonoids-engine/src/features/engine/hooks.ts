import type { SpatialPoint } from '../spatial-index/index.js'
import type { CollisionType, EntityRef } from './types.js'

export interface EngineHooks {
  onCollision?: (a: EntityRef, b: EntityRef, type: CollisionType) => void
  onEntitySpawned?: (ref: EntityRef) => void
  onEntityDestroyed?: (ref: EntityRef) => void
  onScoreChanged?: (playerId: string, score: number, delta: number) => void
  onWaveSpawned?: (wave: number) => void
  onPlayerDied?: (playerId: string) => void
  onPlayerRegenerated?: (playerId: string) => void
  onGameOver?: (playerId: string) => void
  /** Provide a spawn position for player regeneration. If undefined, falls back to random. */
  getRegenerationPosition?: (playerId: string) => SpatialPoint | undefined
  /** Optional narrow-phase verification. Return false to reject a broad-phase collision. */
  verifyCollision?: (a: EntityRef, b: EntityRef, type: CollisionType) => boolean
}
