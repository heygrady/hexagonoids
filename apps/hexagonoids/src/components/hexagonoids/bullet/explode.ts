import { isRockStore, type TargetStore } from '../colission/typeCheck'
import {
  EXPLOSION_LARGE_SPEED,
  EXPLOSION_MEDIUM_SPEED,
  EXPLOSION_SMALL_SPEED,
  ROCK_LARGE_SIZE,
  ROCK_MEDIUM_SIZE,
} from '../constants'
import type { BulletStore } from '../store/bullet/BulletStore'

import { createBulletNodes } from './createBulletNodes'
import { orientToTarget } from './orientToTarget'

export const explode = ($bullet: BulletStore, $target: TargetStore) => {
  let { id, originNode, bulletNode } = $bullet.get()
  const scene = $target.get().originNode?.getScene()

  if (scene == null) {
    throw new Error('Cannot explode bullet without a scene')
  }

  if (originNode == null || bulletNode == null) {
    if ((originNode == null) !== (bulletNode == null)) {
      throw new Error('Bullet originNode and bulletNode must be set together')
    }
    if (id === undefined) {
      throw new Error('Bullet id must be set')
    }

    createBulletNodes(scene, $bullet)
    ;({ originNode, bulletNode } = $bullet.get())
  }

  // make it visible
  if (originNode != null && bulletNode != null) {
    bulletNode.isVisible = true
    originNode.setEnabled(true)
  }

  // Set the explosion size and speed based on the target type
  if (isRockStore($target)) {
    const size = $target.get().size
    $bullet.setKey('size', size)
    // FIXME: apply a random factor
    const speed =
      size === ROCK_LARGE_SIZE
        ? EXPLOSION_LARGE_SPEED
        : size === ROCK_MEDIUM_SIZE
        ? EXPLOSION_MEDIUM_SPEED
        : EXPLOSION_SMALL_SPEED
    $bullet.setKey('speed', speed + Math.random() * speed)
  } else {
    // a ship explosion is the same as a small rock
    $bullet.setKey('size', 0)
    $bullet.setKey(
      'speed',
      EXPLOSION_SMALL_SPEED + Math.random() * EXPLOSION_SMALL_SPEED
    )
  }

  // random heading between -Math.PI and Math.PI
  $bullet.setKey('heading', Math.random() * Math.PI * 2 - Math.PI)

  // Set the bullet's initial position and orientation
  orientToTarget($bullet, $target)

  $bullet.setKey('firedAt', Date.now())
}
