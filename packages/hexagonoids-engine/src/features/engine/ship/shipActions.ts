import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import type { RNG } from '@neat-evolution/utils'
import type { SpatialPoint } from '../../spatial-index/index.js'
import { spawnBullet } from '../bullet/bulletActions.js'
import { FIRE_COOLDOWN } from '../constants.js'
import { defaultShipState } from '../defaults.js'
import { elapsed } from '../gameTime.js'
import { generateId } from '../generateId.js'
import { unitPointToQuaternion } from '../physics/latLng.js'
import type { BulletState, GameState, ShipState } from '../types.js'

/**
 * Spawn a new ship for a player at a unit-sphere point.
 */
export function spawnShip(
  game: GameState,
  playerId: string,
  point: SpatialPoint,
  _rng: RNG
): ShipState {
  const id = generateId('ship')
  const orientation = unitPointToQuaternion(point.x, point.y, point.z)
  const ship: ShipState = {
    ...defaultShipState,
    id,
    playerId,
    orientation,
    x: point.x,
    y: point.y,
    z: point.z,
    angularVelocity: Vector3.Zero(),
  }
  game.ships.set(id, ship)
  return ship
}

/**
 * Remove a ship from the game.
 */
export function destroyShip(game: GameState, shipId: string): void {
  game.ships.delete(shipId)
}

/**
 * Fire a bullet from a ship (checks cooldown via game.now).
 * Returns the bullet if fired, null if on cooldown.
 */
export function fireBullet(
  game: GameState,
  ship: ShipState,
  rng: RNG
): BulletState | null {
  if (elapsed(game, ship.firedAt) < FIRE_COOLDOWN) {
    return null
  }
  const bullet = spawnBullet(game, ship, rng)
  ship.firedAt = game.now
  return bullet
}
