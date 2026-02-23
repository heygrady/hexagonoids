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
}
