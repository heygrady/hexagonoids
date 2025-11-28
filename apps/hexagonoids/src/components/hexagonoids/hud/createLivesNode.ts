import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'

import { PLAYER_STARTING_LIVES, SHIP_SCALE } from '../constants'
import { createShipPolygon } from '../ship/createShipPolygon'
import { turnNodeBy } from '../ship/orientation'

export const createLivesNode = (
  scene: Scene,
  lives: number = PLAYER_STARTING_LIVES
): TransformNode => {
  const originNode = new TransformNode('livesOrigin')

  const shipScale = SHIP_SCALE * 0.5
  for (let i = 0; i < PLAYER_STARTING_LIVES; i++) {
    const shipNode = createShipPolygon(scene, `life_${i}`)
    shipNode.parent = originNode
    shipNode.scaling.scaleInPlace(shipScale)
    turnNodeBy(shipNode, Math.PI * 0.5)

    // right justify the ships
    const shipWidth =
      shipNode.getBoundingInfo().boundingBox.extendSize.z * 2 * shipScale
    shipNode.position.x = -(shipWidth / 2 + shipWidth * i + 0.02 * i)
    if (i >= lives) {
      shipNode.isVisible = false
    }
  }

  return originNode
}

export const updateLives = (originNode: TransformNode, lives: number) => {
  originNode.getChildMeshes().forEach((n, i) => {
    if (i < lives) {
      n.isVisible = true
    } else {
      n.isVisible = false
    }
  })
}
