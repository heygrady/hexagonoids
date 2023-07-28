import {
  TransformNode,
  type Scene,
  Quaternion,
  type AbstractMesh,
  Color3,
} from '@babylonjs/core'
import { cellToLatLng } from 'h3-js'

import { getCommonMaterial } from '../common/commonMaterial'
import { CELL_VISITED_OPACITY, RADIUS } from '../constants'
import { geoToVector3 } from '../geoCoords/geoToVector3'
import { getYawPitch } from '../ship/getYawPitch'
import { moveNodeTo } from '../ship/orientation'
import type { CellStore } from '../store/cell/CellStore'

import { createCellPolygon } from './createCellPolygon'

interface CellNodesCacheValue {
  originNode: TransformNode
  positionNode: TransformNode
  cellNode: AbstractMesh
}

// FIXME: allow RADIUS to be passed
const createCellNodes = (scene: Scene, h: string): CellNodesCacheValue => {
  // 1. originNode
  const originNode = new TransformNode(`cellOrigin_${h}`)

  // FIXME: enable scaling separately from radius
  const h3CellOrigin = scene.getTransformNodeByName('h3CellOrigin')
  if (h3CellOrigin != null) {
    originNode.parent = h3CellOrigin
  }

  originNode.rotationQuaternion = Quaternion.Identity()

  // FIXME: this orientation affects the mesh that is created
  // 2. rotate the origin node (important)
  const [lat, lng] = cellToLatLng(h)
  const centerPosition = geoToVector3(lat, lng, RADIUS)
  const [yaw, pitch] = getYawPitch(centerPosition)
  moveNodeTo(originNode, yaw, pitch)

  // 3. positionNode
  const positionNode = new TransformNode(`cellPosition_${h}`)
  positionNode.parent = originNode
  positionNode.position.y = RADIUS // Initialize to up on the sphere

  // 4. cellNode
  const cellNode = createCellPolygon(scene, positionNode, h, RADIUS)

  cellNode.material = getCommonMaterial(scene, {
    diffuseColor: Color3.FromHexString('#999999'),
    alpha: CELL_VISITED_OPACITY,
  }).clone(`cellMaterial_${h}`)
  return { originNode, positionNode, cellNode }
}

export const generateCell = (
  $cell: CellStore,
  scene: Scene
): CellNodesCacheValue => {
  let { originNode, positionNode, cellNode } = $cell.get()

  // Create the cell nodes if they don't exist
  if (originNode == null || positionNode == null || cellNode == null) {
    ;({ originNode, positionNode, cellNode } = createCellNodes(
      scene,
      $cell.get().h ?? 'unknown'
    ))
    $cell.setKey('cellNode', cellNode)
    $cell.setKey('positionNode', positionNode)
    $cell.setKey('originNode', originNode)
    cellNode.onDisposeObservable.addOnce(() => {
      $cell.setKey('cellNode', null)
    })
    positionNode.onDisposeObservable.addOnce(() => {
      $cell.setKey('positionNode', null)
    })
    originNode.onDisposeObservable.addOnce(() => {
      $cell.setKey('originNode', null)
    })
  }

  // make sure the nodes are visible
  cellNode.isVisible = true
  originNode.setEnabled(true)

  return { originNode, positionNode, cellNode }
}
