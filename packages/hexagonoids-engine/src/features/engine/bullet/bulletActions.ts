import { Quaternion } from '@babylonjs/core/Maths/math.vector.js'
import type { RNG } from '@neat-evolution/utils'

import { BULLET_LIFETIME, BULLET_SPEED, GUN_DISTANCE } from '../constants.js'
import { defaultBulletState } from '../defaults.js'
import { elapsed } from '../gameTime.js'
import { generateId } from '../generateId.js'
import { quaternionToUnitPointFastInPlace } from '../physics/latLng.js'
import { headingToAngularVelocity } from '../physics/quaternionPhysics.js'
import type { BulletState, GameState, ShipState } from '../types.js'

/**
 * Spawn a bullet from a ship.
 */
export function spawnBullet(
  game: GameState,
  ship: ShipState,
  _rng: RNG
): BulletState {
  const id = generateId('bullet')

  // 1. Start with ship's orientation
  let bulletOrientation = ship.orientation.clone()

  // 2. Apply ship's yaw (facing direction)
  if (ship.yaw !== 0) {
    bulletOrientation = bulletOrientation.multiply(
      Quaternion.RotationYawPitchRoll(ship.yaw, 0, 0)
    )
  }

  // 3. Pitch forward by GUN_DISTANCE
  bulletOrientation = bulletOrientation.multiply(
    Quaternion.RotationYawPitchRoll(0, GUN_DISTANCE, 0)
  )
  bulletOrientation.normalize()

  // 4. Velocity: inherit ship's velocity + BULLET_SPEED forward
  const bulletVelocity = ship.angularVelocity.clone()
  const firingVelocity = headingToAngularVelocity(
    bulletOrientation,
    0,
    BULLET_SPEED
  )
  bulletVelocity.addInPlace(firingVelocity)

  const bullet: BulletState = {
    ...defaultBulletState,
    id,
    ownerId: ship.id,
    orientation: bulletOrientation,
    x: 0,
    y: 0,
    z: 0,
    angularVelocity: bulletVelocity,
    firedAt: game.now,
  }
  quaternionToUnitPointFastInPlace(bulletOrientation, bullet)
  game.bullets.set(id, bullet)
  return bullet
}

/**
 * Remove a bullet from the game.
 */
export function destroyBullet(game: GameState, bulletId: string): void {
  game.bullets.delete(bulletId)
}

/**
 * Check and remove expired bullets.
 */
export function expireBullets(game: GameState): void {
  for (const [id, bullet] of game.bullets) {
    if (elapsed(game, bullet.firedAt) > BULLET_LIFETIME) {
      game.bullets.delete(id)
    }
  }
}
