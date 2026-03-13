import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { Scene } from '@babylonjs/core/scene'

import { getCommonMaterial } from '../common/commonMaterial'

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
