import { Vector2 } from '@babylonjs/core/Maths/math.vector'
import { type InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import { PolygonMeshBuilder } from '@babylonjs/core/Meshes/polygonMesh'
import type { Scene } from '@babylonjs/core/scene'
import earcut from 'earcut'

import { getCommonMaterial } from '../common/commonMaterial'

export const SHIP_POLYGON = [
  new Vector2(-40, 32),
  new Vector2(56, 0),
  new Vector2(-40, -32),
  new Vector2(-24, -16),
  new Vector2(-24, 16),
]

export const SHIP_HOLE_POLYGON = [
  new Vector2(-16, 14),
  new Vector2(32, 0),
  new Vector2(-16, -14),
]

let shipMaster: Mesh | null = null

/**
 * Initialize the ship master mesh. This should be called once when the scene is set up.
 * Creates a single master mesh that will be used to create ship instances.
 * @param {Scene} scene - The scene
 */
export const initializeShipMaster = (scene: Scene): void => {
  if (shipMaster !== null) {
    return // Already initialized
  }

  const builder = new PolygonMeshBuilder(
    'shipMaster',
    SHIP_POLYGON,
    scene,
    earcut
  )
  builder.addHole(SHIP_HOLE_POLYGON)

  shipMaster = builder.build()
  shipMaster.isVisible = false // Hide the master mesh
  shipMaster.material = getCommonMaterial(scene) // Assign shared material
}

/**
 * Create a ship polygon.
 * @param {Scene} scene - The scene
 * @param {string} id - The ship ID
 * @returns {InstancedMesh} The created ship mesh
 */
export const createShipPolygon = (scene: Scene, id: string): InstancedMesh => {
  // Lazy initialization: create master on first call if not already initialized
  if (shipMaster === null) {
    initializeShipMaster(scene)
  }

  // Create an instance of the master mesh
  if (shipMaster == null) {
    throw new Error('Ship master not initialized')
  }
  return shipMaster.createInstance(`ship_${id}`)
}
