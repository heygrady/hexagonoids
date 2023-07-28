import type { BulletStore } from '../store/bullet/BulletStore'

import { createBulletNodes } from './createBulletNodes'
import { orientToShip } from './orientToShip'

/**
 * INTERNAL USE ONLY. see fireBullet in store/bulletPool
 *
 * Updates bullet state and bullet nodes.
 * @param $bullet the bullet to fire
 */
export const fireBullet = ($bullet: BulletStore) => {
  const $ship = $bullet.get().$ship
  if ($ship == null) {
    console.warn('Cannot fire bullet without a ship')
    return
  }

  const shipState = $ship.get()
  const { originNode: shipOriginNode } = shipState

  if (shipOriginNode == null) {
    console.warn('Cannot fire bullet without a ShipState.originNode')
    return
  }

  let { id, originNode, bulletNode } = $bullet.get()

  if (originNode == null || bulletNode == null) {
    if ((originNode == null) !== (bulletNode == null)) {
      throw new Error('Bullet originNode and bulletNode must be set together')
    }
    if (id === undefined) {
      throw new Error('Bullet id must be set')
    }

    createBulletNodes(shipOriginNode.getScene(), $bullet)
    ;({ originNode, bulletNode } = $bullet.get())
  }

  // make it visible
  if (originNode != null && bulletNode != null) {
    bulletNode.isVisible = true
    originNode.setEnabled(true)
  }

  // Set the bullet's initial position and velocity
  orientToShip($bullet)

  $bullet.setKey('firedAt', Date.now())
}
