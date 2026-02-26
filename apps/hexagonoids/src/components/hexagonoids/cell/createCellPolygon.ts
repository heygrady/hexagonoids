import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreatePolyhedron } from '@babylonjs/core/Meshes/Builders/polyhedronBuilder'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'
import { latLngToVector3 } from '@heygrady/h3-babylon'
import { cellToLatLng, cellToVertexes, vertexToLatLng } from 'h3-js'
import qh from 'quickhull3d'

import { RADIUS } from '../constants'

// FIXME: positionNode should be in a scaled position (if we want to scale the cells)
export const worldToLocal = (
  vector: Vector3,
  positionNode: TransformNode
): Vector3 => {
  const worldMatrix = positionNode.getWorldMatrix()
  const localToWorldMatrix = worldMatrix.clone().invert()
  return Vector3.TransformCoordinates(vector, localToWorldMatrix)
}

const createDipyramid = (basePoints: Vector3[], apexPoint: Vector3) => {
  const vertices: Vector3[] = [...basePoints]

  const largestValue = vertices.reduce((acc, v) => {
    const value = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z))
    return acc > value ? acc : value
  }, 0)

  vertices.push(apexPoint)
  // FIXME: fiddle with this height
  vertices.push(apexPoint.subtract(new Vector3(0, largestValue / 4, 0)))

  const vertex = vertices.map((v) => v.asArray())
  const face = qh(vertex)
  return { vertex, face }
}

export const createCellPolygon = (
  scene: Scene,
  positionNode: TransformNode,
  h: string,
  radius: number = RADIUS
) => {
  // NOTE: vertexes are far superior to boundaries
  const cellVertexes: Vector3[] = []
  for (const v of cellToVertexes(h)) {
    const [lat, lng] = vertexToLatLng(v)
    const localPosition = latLngToVector3(lat, lng, radius)
    const position = worldToLocal(localPosition, positionNode)
    cellVertexes.push(position)
  }

  const [lat, lng] = cellToLatLng(h)
  const cellCenter = worldToLocal(
    latLngToVector3(lat, lng, radius),
    positionNode
  )

  const cellNode = CreatePolyhedron(
    'customPolyhedron',
    { custom: createDipyramid(cellVertexes, cellCenter) },
    scene
  )

  cellNode.parent = positionNode

  return cellNode
}
