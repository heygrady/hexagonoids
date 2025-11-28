import { Vector2 } from '@babylonjs/core/Maths/math.vector'
import { type InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import { PolygonMeshBuilder } from '@babylonjs/core/Meshes/polygonMesh'
import type { Scene } from '@babylonjs/core/scene'
import earcut from 'earcut'

import { getCommonMaterial } from '../common/commonMaterial'

let shipTailMaster: Mesh | null = null

/**
 * Initialize the ship tail master mesh. This should be called once when the scene is set up.
 * Creates a single master mesh that will be used to create ship tail instances.
 * @param {Scene} scene - The scene
 */
export const initializeShipTailMaster = (scene: Scene): void => {
  if (shipTailMaster !== null) {
    return // Already initialized
  }

  const builder = new PolygonMeshBuilder(
    'shipTailMaster',
    [new Vector2(-24, -16), new Vector2(-56, 0), new Vector2(-24, 16)],
    scene,
    earcut
  )
  builder.addHole([
    new Vector2(-24, -8),
    new Vector2(-40, 0),
    new Vector2(-24, 8),
  ])

  shipTailMaster = builder.build()
  shipTailMaster.isVisible = false // Hide the master mesh
  shipTailMaster.material = getCommonMaterial(scene) // Assign shared material
}

/**
 * Create a ship tail polygon.
 * @param {Scene} scene - The scene
 * @param {string} id - The ship ID
 * @returns {InstancedMesh} The created ship tail mesh
 */
export const createShipTailPolygon = (
  scene: Scene,
  id: string
): InstancedMesh => {
  // Lazy initialization: create master on first call if not already initialized
  if (shipTailMaster === null) {
    initializeShipTailMaster(scene)
  }

  // Create an instance of the master mesh
  if (shipTailMaster == null) {
    throw new Error('Ship tail master not initialized')
  }
  return shipTailMaster.createInstance(`shipTail_${id}`)
}
