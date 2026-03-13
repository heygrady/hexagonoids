import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import {
  createGame,
  defaultBulletState,
  defaultPlayerState,
  defaultRockState,
  defaultShipState,
  type EngineInstance,
  generateId,
  resetIdCounter,
  unitPointToQuaternion,
} from '@heygrady/hexagonoids-engine'

import type { ScenarioSnapshot } from './types.js'

/**
 * Restore a full GameState from a ScenarioSnapshot.
 *
 * Resets the ID counter for deterministic entity IDs, then reconstructs
 * ship, player, rocks, and bullets from the snapshot's plain data.
 */
export function restoreSnapshot(
  snapshot: ScenarioSnapshot,
  seed?: string
): EngineInstance {
  // Reset ID counter for deterministic IDs
  resetIdCounter()

  // Create fresh game state (no seed — state is fully specified by snapshot)
  const engine = createGame({ seed: seed ?? snapshot.id, useFastThrust: true })
  const { state } = engine

  // Set game-level fields
  state.now = snapshot.gameTime
  state.wave = snapshot.wave
  state.startedAt = 0

  // Reconstruct ship
  const shipId = generateId('ship')
  const playerId = 'player-1'
  const shipOrientation = unitPointToQuaternion(
    snapshot.ship.x,
    snapshot.ship.y,
    snapshot.ship.z
  )

  state.ships.set(shipId, {
    ...defaultShipState,
    id: shipId,
    playerId,
    orientation: shipOrientation,
    x: snapshot.ship.x,
    y: snapshot.ship.y,
    z: snapshot.ship.z,
    yaw: snapshot.ship.yaw,
    angularVelocity: new Vector3(
      snapshot.ship.angularVelocityX,
      snapshot.ship.angularVelocityY,
      snapshot.ship.angularVelocityZ
    ),
    alive: snapshot.ship.alive,
    firedAt: snapshot.ship.firedAt,
  })

  // Reconstruct player
  state.players.set(playerId, {
    ...defaultPlayerState,
    id: playerId,
    shipId,
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

  // Reconstruct rocks
  for (const rockData of snapshot.rocks) {
    const rockId = generateId('rock')
    const rockOrientation = unitPointToQuaternion(
      rockData.x,
      rockData.y,
      rockData.z
    )
    state.rocks.set(rockId, {
      ...defaultRockState,
      id: rockId,
      orientation: rockOrientation,
      x: rockData.x,
      y: rockData.y,
      z: rockData.z,
      angularVelocity: new Vector3(
        rockData.angularVelocityX,
        rockData.angularVelocityY,
        rockData.angularVelocityZ
      ),
      size: rockData.size,
      value: rockData.value,
    })
  }

  // Reconstruct bullets
  for (const bulletData of snapshot.bullets) {
    const bulletId = generateId('bullet')
    const bulletOrientation = unitPointToQuaternion(
      bulletData.x,
      bulletData.y,
      bulletData.z
    )
    state.bullets.set(bulletId, {
      ...defaultBulletState,
      id: bulletId,
      ownerId: shipId,
      orientation: bulletOrientation,
      x: bulletData.x,
      y: bulletData.y,
      z: bulletData.z,
      angularVelocity: new Vector3(
        bulletData.angularVelocityX,
        bulletData.angularVelocityY,
        bulletData.angularVelocityZ
      ),
      firedAt: bulletData.firedAt,
    })
  }

  return engine
}
