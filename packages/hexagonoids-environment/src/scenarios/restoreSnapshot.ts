import {
  createGame,
  defaultPlayerState,
  type EngineInstance,
  type GameState,
  generateId,
  obtainBulletEntity,
  obtainRockEntity,
  obtainShipEntity,
  quatFromUnitPoint,
  quatToUnitPoint,
  releaseBulletEntity,
  releaseRockEntity,
  releaseShipEntity,
  resetIdCounter,
  vec3Set,
} from '@heygrady/hexagonoids-engine'

import type { ScenarioSnapshot } from './types.js'

// Track previous state so we can recycle entities back to pools.
let _prevState: GameState | null = null

/**
 * Release all entities from a game state back to their respective pools.
 */
function releaseEntities(state: GameState): void {
  for (const ship of state.ships.values()) releaseShipEntity(ship)
  state.ships.clear()
  for (const rock of state.rocks.values()) releaseRockEntity(rock)
  state.rocks.clear()
  for (const bullet of state.bullets.values()) releaseBulletEntity(bullet)
  state.bullets.clear()
}

/**
 * Restore a full GameState from a ScenarioSnapshot.
 *
 * Uses entity pools to avoid Float64Array allocations — obtain pre-allocated
 * entities and write snapshot values in-place. Previous restore's entities
 * are recycled back to pools at the start of each call.
 */
export function restoreSnapshot(
  snapshot: ScenarioSnapshot,
  seed?: string
): EngineInstance {
  // Recycle previous entities back to pools
  if (_prevState != null) {
    releaseEntities(_prevState)
    _prevState = null
  }

  // Reset ID counter for deterministic IDs
  resetIdCounter()

  // Create fresh game state
  const engine = createGame({ seed: seed ?? snapshot.id })
  const { state } = engine
  _prevState = state

  // Set game-level fields
  state.now = snapshot.gameTime
  state.wave = snapshot.wave
  state.startedAt = 0

  // Reconstruct ship — obtain from pool, write in-place
  const ship = obtainShipEntity()
  ship.id = generateId('ship')
  ship.playerId = 'player-1'
  ship.yaw = snapshot.ship.yaw
  ship.alive = snapshot.ship.alive
  ship.firedAt = snapshot.ship.firedAt
  quatFromUnitPoint(
    ship.orientation,
    snapshot.ship.x,
    snapshot.ship.y,
    snapshot.ship.z
  )
  quatToUnitPoint(ship.position, ship.orientation)
  vec3Set(
    ship.angularVelocity,
    snapshot.ship.angularVelocityX,
    snapshot.ship.angularVelocityY,
    snapshot.ship.angularVelocityZ
  )
  state.ships.set(ship.id, ship)

  const playerId = 'player-1'

  // Reconstruct player
  state.players.set(playerId, {
    ...defaultPlayerState,
    id: playerId,
    shipId: ship.id,
    score: snapshot.player.score,
    lives: snapshot.player.lives,
    alive: snapshot.player.alive,
    startedAt: snapshot.player.startedAt,
    diedAt: snapshot.player.diedAt,
    regeneratedAt: snapshot.player.regeneratedAt,
    waveSpawnedAt: snapshot.player.waveSpawnedAt,
    nextWaveCheckAt: snapshot.player.nextWaveCheckAt,
    lastRockEncounterAt: snapshot.player.lastRockEncounterAt,
    leftPressedAt: snapshot.player.leftPressedAt,
    rightPressedAt: snapshot.player.rightPressedAt,
    thrustPressedAt: snapshot.player.thrustPressedAt,
  })

  // Reconstruct rocks — obtain from pool, write in-place
  for (const rockData of snapshot.rocks) {
    const rock = obtainRockEntity()
    rock.id = generateId('rock')
    rock.size = rockData.size
    rock.value = rockData.value
    quatFromUnitPoint(rock.orientation, rockData.x, rockData.y, rockData.z)
    quatToUnitPoint(rock.position, rock.orientation)
    vec3Set(
      rock.angularVelocity,
      rockData.angularVelocityX,
      rockData.angularVelocityY,
      rockData.angularVelocityZ
    )
    state.rocks.set(rock.id, rock)
  }

  // Reconstruct bullets — obtain from pool, write in-place
  for (const bulletData of snapshot.bullets) {
    const bullet = obtainBulletEntity()
    bullet.id = generateId('bullet')
    bullet.ownerId = ship.id
    bullet.firedAt = bulletData.firedAt
    quatFromUnitPoint(
      bullet.orientation,
      bulletData.x,
      bulletData.y,
      bulletData.z
    )
    quatToUnitPoint(bullet.position, bullet.orientation)
    vec3Set(
      bullet.angularVelocity,
      bulletData.angularVelocityX,
      bulletData.angularVelocityY,
      bulletData.angularVelocityZ
    )
    state.bullets.set(bullet.id, bullet)
  }

  return engine
}
