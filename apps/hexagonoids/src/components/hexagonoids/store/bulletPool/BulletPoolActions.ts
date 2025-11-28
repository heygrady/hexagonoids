import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import { explode as _explode } from '../../bullet/explode'
import { fireBullet as _fireBullet } from '../../bullet/fireBullet'
import type { TargetStore } from '../../colission/typeCheck'
import type { BulletStore } from '../bullet/BulletStore'
import { score } from '../player/PlayerActions'
import { setFiredAt } from '../ship/ShipSetters'
import type { ShipStore } from '../ship/ShipStore'

import { getBulletStore } from './BulletPool'
import { addBullet, removeBullet } from './BulletPoolSetters'
import type { BulletPoolStore } from './BulletPoolStore'

export interface BulletPoolActions {
  explode: OmitFirstArg<typeof explode>
  fire: OmitFirstArg<typeof fireBullet>
  collideWithTarget: OmitFirstArg<typeof collideWithTarget>
}

export const bindBulletPoolActions = (
  $bulletPool: BulletPoolStore
): BulletPoolActions => ({
  explode: action($bulletPool, 'explode', explode),
  fire: action($bulletPool, 'fireBullet', fireBullet),
  collideWithTarget: action(
    $bulletPool,
    'collideWithTarget',
    collideWithTarget
  ),
})

/**
 * Creates several "explosion" bullets at the given location.
 * Used as an explosion effect when a rock (or ship) is destroyed.
 * @param {BulletPoolStore} $bullets - The bullet pool store
 * @param {TargetStore} $target - The target to explode
 * @returns {BulletStore[]} the bullets that were created
 */
export const explode = ($bullets: BulletPoolStore, $target: TargetStore) => {
  const explosion: BulletStore[] = []
  // fire six "explosion" bullets
  for (let i = 0; i < 6; i++) {
    // Get a clean bullet from the pool (assumes pool is initialized)
    const $bullet = getBulletStore()
    $bullet.setKey('type', 'explosion')
    _explode($bullet, $target)

    // Add the bullet to the active bullets
    addBullet($bullets, $bullet)
  }

  return explosion
}

/**
 * Fires a bullet from the given ship.
 * @param {BulletPoolStore} $bullets - set of active bullets
 * @param {ShipStore} $ship - the ship that fired the bullet
 * @returns {BulletStore} the bullet that was fired
 */
export const fireBullet = ($bullets: BulletPoolStore, $ship: ShipStore) => {
  // Get a clean bullet from the pool (assumes pool is initialized)
  const $bullet = getBulletStore()

  // Mark the owner of the bullet
  $bullet.setKey('$ship', $ship)

  // Initialize the bullet
  _fireBullet($bullet)

  // Add the bullet to the active bullets
  addBullet($bullets, $bullet)
  setFiredAt($ship)
  return $bullet
}

/**
 * Handles collision between a bullet and a target.
 * @param {BulletPoolStore} $bullets - The bullet pool store
 * @param {BulletStore} $bullet - The bullet
 * @param {TargetStore} $target - The target
 */
export const collideWithTarget = (
  $bullets: BulletPoolStore,
  $bullet: BulletStore,
  $target: TargetStore
) => {
  const { value } = $target.get()
  const { $ship } = $bullet.get()

  if ($ship != null && value != null) {
    const $player = $ship.get().$player
    if ($player != null) {
      score($player, value)
    }
  }

  removeBullet($bullets, $bullet)
}
