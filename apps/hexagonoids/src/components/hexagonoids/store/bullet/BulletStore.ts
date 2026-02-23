import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import { type MapStore, map } from 'nanostores'
import { createUniqueId } from 'solid-js'

import { type BulletState, defaultBulletState } from './BulletState'

export type BulletStore = MapStore<BulletState>

/**
 * This is used by the BulletPool to create bullets.
 * @returns {BulletStore} The created bullet store
 */
export const createBulletStore = (): BulletStore => {
  const $bullet = map<BulletState>({ ...defaultBulletState })
  $bullet.setKey('id', createUniqueId())
  return $bullet
}

/**
 * This is used by the BulletPool to recycle bullets.
 * @param {BulletStore} $bullet - The bullet store to reset
 * @returns {BulletStore} The reset bullet store
 */
export const resetBullet = ($bullet: BulletStore) => {
  // preserve the ID and nodes
  const { id, originNode, bulletNode } = $bullet.get()

  if (originNode != null && bulletNode != null) {
    // make it invisible
    bulletNode.isVisible = false
    // disable it
    originNode.setEnabled(false)
  }

  // reset the quaternions (only originNode for bullets)
  if (originNode != null) {
    originNode.rotationQuaternion = Quaternion.Identity()
  }

  $bullet.set({ ...defaultBulletState, id, originNode, bulletNode })
  return $bullet
}
