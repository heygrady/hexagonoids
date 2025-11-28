import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'

import { RADIUS, SHIP_SCALE } from '../constants'
import type { ShipStore } from '../store/ship/ShipStore'

import { createSegmentPolygons } from './createSegmentPolygons'
import { turnNodeBy } from './orientation'

export type SegmentStores = [
  $segment1: ShipStore,
  $segment2: ShipStore,
  $segment3: ShipStore,
]

export type SegmentNodes = [
  segment1OriginNode: TransformNode,
  segment2OriginNode: TransformNode,
  segment3OriginNode: TransformNode,
]

export const createSegmentNodes = (
  scene: Scene,
  shipId: string,
  segments: SegmentStores
): SegmentNodes => {
  const segmentPolygons = createSegmentPolygons(scene, shipId)

  const globe = scene.getMeshByName('globe')

  const segmentNodes: TransformNode[] = []
  for (const [i, segmentNode] of segmentPolygons.entries()) {
    const $segment = segments[i]
    const segmentId = $segment.get().id ?? `${shipId}_${i}`

    segmentNode.scaling.setAll(SHIP_SCALE)
    turnNodeBy(segmentNode, -Math.PI / 2)

    const originNode = new TransformNode(`originNode_${segmentId}`)
    originNode.rotationQuaternion = Quaternion.Identity()

    const positionNode = new TransformNode(`positionNode_${segmentId}`)
    positionNode.position.y = RADIUS // Initialize to up on the sphere

    const orientationNode = new TransformNode(`orientationNode_${segmentId}`)
    orientationNode.rotationQuaternion = Quaternion.Identity()

    if (globe != null) {
      originNode.parent = globe
    }

    positionNode.parent = originNode
    orientationNode.parent = positionNode
    segmentNode.parent = orientationNode

    $segment.setKey('originNode', originNode)
    $segment.setKey('positionNode', positionNode)
    $segment.setKey('orientationNode', orientationNode)
    $segment.setKey('shipNode', segmentNode)

    segmentNodes.push(originNode)
  }

  // Tell the $ship about the ship
  return segmentNodes as SegmentNodes
}
