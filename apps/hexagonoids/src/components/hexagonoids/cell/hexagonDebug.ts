import {
  type AbstractMesh,
  Color3,
  type Scene,
  type StandardMaterial,
  type TransformNode,
  type Vector3,
} from '@babylonjs/core'
import type { Nullable } from 'vitest'

import { localToWorld, type createHexagon } from '../Collision'
import { vector3ToGeo } from '../geoCoords/geoToVector3'
import { getYawPitch } from '../ship/getYawPitch'
import { moveNodeTo } from '../ship/orientation'

import { getCellMarkers } from './getCellMarkers'

export const generateHexagonDebugNodes = (
  scene: Scene,
  id: string | undefined,
  hexagon: ReturnType<typeof createHexagon>,
  position: Vector3
) => {
  const key = id ?? 'unknown'

  // create 6 spheres
  const colors: Color3[] = [
    Color3.Red(),
    Color3.Green(),
    Color3.Blue(),
    Color3.Magenta(),
    Color3.Yellow(),
    Color3.Teal(),
  ]
  const markers = getCellMarkers(scene, key, true) as TransformNode[]
  const firstMarker = markers[0]
  const firstMarkerNode = firstMarker.getChildren(
    undefined,
    true
  )[0] as AbstractMesh

  // position the first marker node at the center position
  const [yaw, pitch] = getYawPitch(position)
  moveNodeTo(firstMarker, yaw, pitch)

  // get the world coordinates of each vertex
  const worldVertices = hexagon.map((v) => localToWorld(v, firstMarkerNode))

  const polygon = worldVertices.map((v) => {
    const { lat, lng } = vector3ToGeo(v)
    return [lat, lng]
  })

  // DEBUG place a sphere at each vertex
  for (const [i, originNode] of markers.entries()) {
    const markerNode = originNode.getChildren(undefined, true)[0] as
      | AbstractMesh
      | undefined
    if (markerNode == null) {
      continue
    }
    const material = markerNode.material as Nullable<StandardMaterial>
    if (material == null) {
      continue
    }
    material.diffuseColor = colors[i] ?? Color3.White()
    material.emissiveColor = colors[i] ?? Color3.White()
    // material.specularColor = Color3.White() // already white?

    // position the origin node
    const [yaw, pitch] = getYawPitch(worldVertices[i])
    moveNodeTo(originNode, yaw, pitch)
  }
  return polygon
}
