import {
  TransformNode,
  type Scene,
  Quaternion,
  type AbstractMesh,
} from '@babylonjs/core'

import { getCommonMaterial } from '../common/commonMaterial'
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
 * @param scene
 * @param id
 * @returns
 */
export const createRockNodes = (scene: Scene, id: string): RockNodes => {
  const rockNode = createRockPolygon(scene, id)

  const originNode = new TransformNode(`rockOrigin_${id}`)
  originNode.rotationQuaternion = Quaternion.Identity()

  const orientationNode = new TransformNode(`rockOrientation_${id}`)
  orientationNode.rotationQuaternion = Quaternion.Identity()

  orientationNode.parent = originNode
  rockNode.parent = orientationNode

  // FIXME: get the globe into game state
  const globe = scene.getMeshByName('globe')
  if (globe != null) {
    originNode.parent = globe
  }

  orientationNode.position.y = RADIUS // Initialize to up on the sphere

  turnNodeBy(rockNode, Math.PI)

  rockNode.material = getCommonMaterial(scene).clone(`rockMaterial_${id}`)
  rockNode.scaling.setAll(ROCK_LARGE_SCALE)

  return { originNode, orientationNode, rockNode }
}
