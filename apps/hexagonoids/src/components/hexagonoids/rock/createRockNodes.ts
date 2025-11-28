import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'

import { RADIUS, ROCK_LARGE_SCALE } from '../constants'
import { turnNodeBy } from '../ship/orientation'

import { createRockPolygon } from './createRockPolygon'

export interface RockNodes {
  originNode: TransformNode
  orientationNode: TransformNode
  rockNode: AbstractMesh
}

/**
 * Create the nodes for a rock.
 * @param {Scene} scene - The scene
 * @param {string} id - The rock ID
 * @param {AbstractMesh | null} [globe] - Globe mesh to parent rock to (from scene state)
 * @returns {RockNodes} The created rock nodes
 */
export const createRockNodes = (
  scene: Scene,
  id: string,
  globe: AbstractMesh | null = null
): RockNodes => {
  const rockNode = createRockPolygon(scene, id)

  const originNode = new TransformNode(`rockOrigin_${id}`)
  originNode.rotationQuaternion = Quaternion.Identity()

  const orientationNode = new TransformNode(`rockOrientation_${id}`)
  orientationNode.rotationQuaternion = Quaternion.Identity()

  orientationNode.parent = originNode
  rockNode.parent = orientationNode

  // Parent to globe if available
  if (globe != null) {
    originNode.parent = globe
  }

  orientationNode.position.y = RADIUS // Initialize to up on the sphere

  turnNodeBy(rockNode, Math.PI)

  rockNode.scaling.setAll(ROCK_LARGE_SCALE)

  return { originNode, orientationNode, rockNode }
}
