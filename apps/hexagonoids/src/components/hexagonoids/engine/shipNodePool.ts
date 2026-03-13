import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'

import { RADIUS, SHIP_CACHE_SIZE, SHIP_SCALE } from '../constants'
import { ObjectPool } from '../pool/ObjectPool'
import { createShipPolygon } from '../ship/createShipPolygon'
import { createShipTailPolygon } from '../ship/createShipTailPolygon'
import { turnNodeBy } from '../ship/orientation'

import type { ShipNodes } from './nodeTypes'

export function createShipNodePool(
  scene: Scene,
  globe: AbstractMesh | null = null
): ObjectPool<ShipNodes> {
  // Scoped to factory call — resets cleanly on HMR when pool is recreated
  let poolCounter = 0

  function createShipNodeBundle(): ShipNodes {
    const id = `pool_ship_${poolCounter++}`

    const shipNode = createShipPolygon(scene, id)
    const shipTailNode = createShipTailPolygon(scene, id)

    shipNode.scaling.setAll(SHIP_SCALE)
    shipTailNode.parent = shipNode
    shipTailNode.isVisible = false

    // Point the ship so the front faces forward
    turnNodeBy(shipNode, -Math.PI / 2)

    const originNode = new TransformNode(`originNode_${id}`)
    originNode.rotationQuaternion = Quaternion.Identity()

    const positionNode = new TransformNode(`positionNode_${id}`)
    positionNode.position.y = RADIUS

    const orientationNode = new TransformNode(`orientationNode_${id}`)
    orientationNode.rotationQuaternion = Quaternion.Identity()

    if (globe != null) {
      originNode.parent = globe
    }

    positionNode.parent = originNode
    orientationNode.parent = positionNode
    shipNode.parent = orientationNode

    // Start hidden — acquire will show
    shipNode.isVisible = false
    originNode.setEnabled(false)

    return { originNode, positionNode, orientationNode, shipNode, shipTailNode }
  }

  return new ObjectPool<ShipNodes>({
    maxSize: SHIP_CACHE_SIZE,
    getScene: () => scene,
    createFn: () => createShipNodeBundle(),
    resetFn: (nodes) => {
      nodes.shipNode.isVisible = false
      nodes.shipTailNode.isVisible = false
      nodes.originNode.setEnabled(false)
      nodes.originNode.rotationQuaternion =
        nodes.originNode.rotationQuaternion ?? Quaternion.Identity()
      nodes.originNode.rotationQuaternion.copyFrom(Quaternion.Identity())
      nodes.orientationNode.rotationQuaternion =
        nodes.orientationNode.rotationQuaternion ?? Quaternion.Identity()
      nodes.orientationNode.rotationQuaternion.copyFrom(Quaternion.Identity())
      return nodes
    },
    disposeFn: (nodes) => {
      nodes.shipTailNode.dispose(false, true)
      nodes.shipNode.dispose(false, true)
      nodes.orientationNode.dispose()
      nodes.positionNode.dispose()
      nodes.originNode.dispose()
    },
    keyFn: (nodes) => nodes.originNode.name,
    name: 'ShipNodePool',
  })
}
