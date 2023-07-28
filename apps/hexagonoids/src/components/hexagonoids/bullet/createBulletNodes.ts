import {
  Mesh,
  MeshBuilder,
  TransformNode,
  type Scene,
  Quaternion,
  Vector3,
} from '@babylonjs/core'

import { getCommonMaterial } from '../common/commonMaterial'
import { BULLET_SCALE, RADIUS } from '../constants'
import { pitchNodeBy } from '../ship/orientation'
import type { BulletStore } from '../store/bullet/BulletStore'

/**
 * Create the nodes for the bullet.
 *
 * This must be done after the $bullet is created in createBulletStore (see store/bullet and bullet/bulletPool).
 *
 * Called by fireBullet in bullet/fireBullet because the ship is known at this point.
 * @param scene
 * @param $bullet
 */
export const createBulletNodes = (scene: Scene, $bullet: BulletStore) => {
  const id = $bullet.get().id ?? 'unknown'

  const bulletNode = MeshBuilder.CreateDisc(
    `bullet_${id}`,
    {
      // DEBUG: huge bullet
      radius: 1,
      tessellation: 6,
      sideOrientation: Mesh.FRONTSIDE,
    },
    scene
  )

  const originNode = new TransformNode(`bulletOrigin_${id}`)
  originNode.rotationQuaternion = Quaternion.Identity()
  bulletNode.parent = originNode
  bulletNode.position.y = RADIUS // Initialize to up on the sphere

  // FIXME: confirm which face is pointing up
  pitchNodeBy(bulletNode, Math.PI / 2)

  const globe = scene.getMeshByName('globe')
  if (globe != null) {
    originNode.parent = globe
  }

  bulletNode.material = getCommonMaterial(scene)
  bulletNode.scaling = new Vector3(BULLET_SCALE, BULLET_SCALE, BULLET_SCALE)

  $bullet.setKey('bulletNode', bulletNode)
  $bullet.setKey('originNode', originNode)
  bulletNode.onDisposeObservable.addOnce(() => {
    $bullet.setKey('bulletNode', null)
  })
  originNode.onDisposeObservable.addOnce(() => {
    $bullet.setKey('originNode', null)
  })
}
