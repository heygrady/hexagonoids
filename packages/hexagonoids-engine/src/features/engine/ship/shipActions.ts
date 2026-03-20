import type { RNG } from '@neat-evolution/utils'
import { spawnBullet } from '../bullet/bulletActions.js'
import { FIRE_COOLDOWN } from '../constants.js'
import { elapsed } from '../gameTime.js'
import { generateId } from '../generateId.js'
import { quatFromUnitPoint, quatToUnitPoint } from '../math/quat.js'
import type { Vec3 } from '../math/types.js'
import { vec3Set } from '../math/vec3.js'
import type { BulletState, GameState, ShipState } from '../types.js'
import { ShipPool } from './shipPool.js'

// Module-scoped pool
const shipPool = new ShipPool()

/**
 * Spawn a new ship for a player at a unit-sphere point.
 */
export function spawnShip(
  game: GameState,
  playerId: string,
  point: Vec3,
  _rng: RNG
): ShipState {
  const ship = shipPool.obtain()
  ship.id = generateId('ship')
  ship.playerId = playerId
  ship.yaw = 0
  ship.alive = true
  ship.firedAt = null

  quatFromUnitPoint(ship.orientation, point[0], point[1], point[2])
  quatToUnitPoint(ship.position, ship.orientation)
  vec3Set(ship.angularVelocity, 0, 0, 0)

  game.ships.set(ship.id, ship)
  return ship
}

/** Obtain a ship entity from the pool (all fields stale — caller must overwrite). */
export function obtainShipEntity(): ShipState {
  return shipPool.obtain()
}

/** Release a ship entity back to the pool. */
export function releaseShipEntity(ship: ShipState): void {
  shipPool.release(ship)
}

/**
 * Remove a ship from the game and release it back to the pool.
 */
export function destroyShip(game: GameState, shipId: string): void {
  const ship = game.ships.get(shipId)
  game.ships.delete(shipId)
  if (ship != null) {
    shipPool.release(ship)
  }
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
