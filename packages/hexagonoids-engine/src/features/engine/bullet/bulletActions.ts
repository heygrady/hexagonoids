import type { RNG } from '@neat-evolution/utils'

import { BULLET_LIFETIME, BULLET_SPEED, GUN_DISTANCE } from '../constants.js'
import { elapsed } from '../gameTime.js'
import { generateId } from '../generateId.js'
import {
  quatCopy,
  quatFromYawPitchRoll,
  quatMultiply,
  quatNormalize,
  quatToUnitPoint,
} from '../math/quat.js'
import type { Quat, Vec3 } from '../math/types.js'
import { vec3AddInPlace, vec3Copy } from '../math/vec3.js'
import { headingToAngularVelocity } from '../physics/quaternionPhysics.js'
import type { BulletState, GameState, ShipState } from '../types.js'
import { BulletPool } from './bulletPool.js'

// Module-scoped pool and scratch
const bulletPool = new BulletPool()
const _tmpQuat = new Float64Array(4) as Quat
const _firingVel = new Float64Array(3) as Vec3

/**
 * Spawn a bullet from a ship.
 */
export function spawnBullet(
  game: GameState,
  ship: ShipState,
  _rng: RNG
): BulletState {
  const bullet = bulletPool.obtain()
  bullet.id = generateId('bullet')
  bullet.ownerId = ship.id
  bullet.firedAt = game.now

  const orientation = bullet.orientation
  const position = bullet.position
  const angularVelocity = bullet.angularVelocity

  // 1. Start with ship's orientation
  quatCopy(orientation, ship.orientation)

  // 2. Apply ship's yaw (facing direction)
  if (ship.yaw !== 0) {
    quatFromYawPitchRoll(_tmpQuat, ship.yaw, 0, 0)
    quatMultiply(orientation, orientation, _tmpQuat)
  }

  // 3. Pitch forward by GUN_DISTANCE
  quatFromYawPitchRoll(_tmpQuat, 0, GUN_DISTANCE, 0)
  quatMultiply(orientation, orientation, _tmpQuat)
  quatNormalize(orientation)

  // 4. Velocity: inherit ship's velocity + BULLET_SPEED forward
  vec3Copy(angularVelocity, ship.angularVelocity)
  headingToAngularVelocity(_firingVel, orientation, 0, BULLET_SPEED)
  vec3AddInPlace(angularVelocity, _firingVel)

  quatToUnitPoint(position, orientation)

  game.bullets.set(bullet.id, bullet)
  return bullet
}

/** Obtain a bullet entity from the pool (all fields stale — caller must overwrite). */
export function obtainBulletEntity(): BulletState {
  return bulletPool.obtain()
}

/** Release a bullet entity back to the pool. */
export function releaseBulletEntity(bullet: BulletState): void {
  bulletPool.release(bullet)
}

/**
 * Remove a bullet from the game and release it back to the pool.
 */
export function destroyBullet(game: GameState, bulletId: string): void {
  const bullet = game.bullets.get(bulletId)
  game.bullets.delete(bulletId)
  if (bullet != null) {
    bulletPool.release(bullet)
  }
}

/**
 * Check and remove expired bullets.
 */
export function expireBullets(game: GameState): void {
  for (const [id, bullet] of game.bullets) {
    if (elapsed(game, bullet.firedAt) > BULLET_LIFETIME) {
      game.bullets.delete(id)
      bulletPool.release(bullet)
    }
  }
}
