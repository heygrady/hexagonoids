import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import {
  createGame,
  defaultPlayerState,
  defaultRockState,
  defaultShipState,
  type GameState,
  generateId,
  latLngToQuaternion,
  resetIdCounter,
} from '@heygrady/hexagonoids-engine'
import { createRNG, type RNG } from '@neat-evolution/utils'

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
): { state: GameState; rng: RNG } {
  // Reset ID counter for deterministic IDs
  resetIdCounter()

  // Create fresh game state (no seed — state is fully specified by snapshot)
  const { state } = createGame({ useFastThrust: true })

  // Set game-level fields
  state.now = snapshot.gameTime
  state.wave = snapshot.wave
  state.startedAt = 0

  // Reconstruct ship
  const shipId = generateId('ship')
  const playerId = 'player-1'
  const shipOrientation = latLngToQuaternion(
    snapshot.ship.lat,
    snapshot.ship.lng
  )

  state.ships.set(shipId, {
    ...defaultShipState,
    id: shipId,
    playerId,
    orientation: shipOrientation,
    lat: snapshot.ship.lat,
    lng: snapshot.ship.lng,
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
    const rockOrientation = latLngToQuaternion(rockData.lat, rockData.lng)
    state.rocks.set(rockId, {
      ...defaultRockState,
      id: rockId,
      orientation: rockOrientation,
      lat: rockData.lat,
      lng: rockData.lng,
      angularVelocity: new Vector3(
        rockData.angularVelocityX,
        rockData.angularVelocityY,
        rockData.angularVelocityZ
      ),
      size: rockData.size,
      value: rockData.value,
    })
  }

  // Skip restoring bullets — pre-existing bullets inflate metrics by
  // crediting the agent with hits it didn't earn.

  // Create deterministic RNG from seed (defaults to snapshot ID)
  const rng = createRNG(seed ?? snapshot.id)

  return { state, rng }
}
