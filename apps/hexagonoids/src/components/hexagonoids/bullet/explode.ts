import { isRockStore, type TargetStore } from '../colission/typeCheck'
import {
  EXPLOSION_LARGE_SPEED,
  EXPLOSION_MEDIUM_SPEED,
  EXPLOSION_SMALL_SPEED,
  ROCK_LARGE_SIZE,
  ROCK_MEDIUM_SIZE,
} from '../constants'
import { headingToAngularVelocity } from '../ship/quaternionPhysics'
import { setAngularVelocity } from '../store/bullet/BulletSetters'
import type { BulletStore } from '../store/bullet/BulletStore'
import { showBullet } from '../store/bulletPool/BulletPool'

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

  // Set the explosion size and speed based on the target type
  let explosionSpeed: number
  if (isRockStore($target)) {
    const size = $target.get().size
    $bullet.setKey('size', size)
    // FIXME: apply a random factor
    const baseSpeed =
      size === ROCK_LARGE_SIZE
        ? EXPLOSION_LARGE_SPEED
        : size === ROCK_MEDIUM_SIZE
          ? EXPLOSION_MEDIUM_SPEED
          : EXPLOSION_SMALL_SPEED
    explosionSpeed = baseSpeed + Math.random() * baseSpeed
  } else {
    // a ship explosion is the same as a small rock
    $bullet.setKey('size', 0)
    explosionSpeed =
      EXPLOSION_SMALL_SPEED + Math.random() * EXPLOSION_SMALL_SPEED
  }

  // Set the bullet's initial position and orientation
  orientToTarget($bullet, $target)

  // Make it visible AFTER orientation is set and nodes are correct
  showBullet($bullet)

  // Calculate angular velocity with random heading
  const { originNode: bulletOriginNode } = $bullet.get()
  if (bulletOriginNode?.rotationQuaternion != null) {
    const randomHeading = Math.random() * Math.PI * 2 - Math.PI
    const angularVelocity = headingToAngularVelocity(
      bulletOriginNode.rotationQuaternion,
      randomHeading,
      explosionSpeed
    )
    setAngularVelocity($bullet, angularVelocity)
  }

  $bullet.setKey('firedAt', Date.now())
}
