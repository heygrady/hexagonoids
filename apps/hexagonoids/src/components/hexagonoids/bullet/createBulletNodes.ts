import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'

import { getCommonMaterial } from '../common/commonMaterial'
import { BULLET_SCALE, RADIUS } from '../constants'
import { pitchNodeBy } from '../ship/orientation'
import type { BulletStore } from '../store/bullet/BulletStore'

let bulletMaster: Mesh | null = null

/**
 * Initialize the bullet master mesh. This should be called once when the scene is set up.
 * Creates a single master disc that will be used to create bullet instances.
 * @param {Scene} scene - The scene
 */
export const initializeBulletMaster = (scene: Scene): void => {
  if (bulletMaster !== null) {
    return // Already initialized
  }

  bulletMaster = CreateDisc(
    'bulletMaster',
    {
      radius: 1,
      tessellation: 6,
      sideOrientation: Mesh.FRONTSIDE,
    },
    scene
  )
  bulletMaster.isVisible = false // Hide the master mesh
  bulletMaster.material = getCommonMaterial(scene) // Assign shared material
}

/**
 * Create the nodes for the bullet.
 *
 * This must be done after the $bullet is created in createBulletStore (see store/bullet and bullet/bulletPool).
 *
 * Called by fireBullet in bullet/fireBullet because the ship is known at this point.
 * @param {Scene} scene - The scene
 * @param {BulletStore} $bullet - The bullet store
 * @param {Mesh | null} [globe] - Globe mesh to parent bullet to (from scene state)
 */
export const createBulletNodes = (
  scene: Scene,
  $bullet: BulletStore,
  globe: Mesh | null = null
) => {
  const id = $bullet.get().id ?? 'unknown'

  // Lazy initialization: create master on first call if not already initialized
  if (bulletMaster === null) {
    initializeBulletMaster(scene)
  }

  const bulletNode = bulletMaster?.createInstance(`bullet_${id}`)
  if (bulletNode == null) {
    throw new Error('Failed to create bullet instance')
  }

  const originNode = new TransformNode(`bulletOrigin_${id}`)
  originNode.rotationQuaternion = Quaternion.Identity()
  bulletNode.parent = originNode
  bulletNode.position.y = RADIUS // Initialize to up on the sphere

  // FIXME: confirm which face is pointing up
  pitchNodeBy(bulletNode, Math.PI / 2)

  // Parent to globe if available
  if (globe != null) {
    originNode.parent = globe
  }

  bulletNode.scaling = new Vector3(BULLET_SCALE, BULLET_SCALE, BULLET_SCALE)

  $bullet.setKey('bulletNode', bulletNode)
  $bullet.setKey('originNode', originNode)

  // NOTE: We no longer use disposal observers to update the nanostore.
  // The pool manages node references directly and clears them during disposal.
  // This prevents re-entry loops caused by synchronous observer execution in Babylon v8.
}
