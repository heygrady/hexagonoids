import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { vector3ToLatLng } from '@heygrady/h3-babylon'
import type { CoordPair } from 'h3-js'
import QuickLRU from 'quick-lru'

import { CELL_CACHE_SIZE } from '../constants'

/**
 * Must be cleared every frame.
 *
 * `meshPolygonCache.clear()`
 */
export const meshPolygonCache = new QuickLRU<AbstractMesh, CoordPair[]>({
  maxSize: CELL_CACHE_SIZE,
})

/**
 * Can live forever
 */
export const meshVerticesCache = new QuickLRU<AbstractMesh, Vector3[]>({
  maxSize: CELL_CACHE_SIZE,
})

export const meshToPolygon = (
  mesh: AbstractMesh,
  type: 'rock' | 'ship' | 'bullet'
): CoordPair[] => {
  if (meshPolygonCache.has(mesh)) {
    return meshPolygonCache.get(mesh) as CoordPair[]
  }

  let vertices = meshVerticesCache.get(mesh) ?? []
  if (!meshVerticesCache.has(mesh)) {
    // Check if the mesh has the POSITION attribute
    if (!mesh.isVerticesDataPresent(VertexBuffer.PositionKind)) {
      meshPolygonCache.set(mesh, [])
      meshVerticesCache.set(mesh, [])
      return [] // Mesh does not have position data
    }

    // Get the raw vertex data for positions
    const verticesData = mesh.getVerticesData(VertexBuffer.PositionKind)
    if (verticesData == null) {
      meshPolygonCache.set(mesh, [])
      meshVerticesCache.set(mesh, [])
      return [] // No vertex data present
    }

    // Each vertex is defined by 3 entries in the array
    for (let i = 0; i < verticesData.length; i += 3) {
      const x = verticesData[i]
      const y = verticesData[i + 1]
      const z = verticesData[i + 2]
      vertices.push(new Vector3(x, y, z))
    }

    if (type === 'rock') {
      // rock has a hole that we need to remove
      const start = Math.floor(vertices.length / 2)
      const count = start
      vertices.splice(start, count)
    } else if (type === 'bullet') {
      // include only the edge vertices of the disk, skip the center vertex
      const edgeVertices = vertices.filter((_, i) => {
        const firstHalf = i % 2 === 0 && i < vertices.length / 2
        const center = firstHalf && i === 0
        return firstHalf && !center
      })
      vertices = edgeVertices
    } else if (type === 'ship') {
      const start = vertices.length - 3
      const count = vertices.length - start
      vertices.splice(start, count)
    }

    meshVerticesCache.set(mesh, vertices)
  }

  if (vertices.length === 0) {
    meshPolygonCache.set(mesh, [])
    return []
  }

  const worldMatrix = mesh.getWorldMatrix()

  const polygon: CoordPair[] = []
  for (const vertex of vertices) {
    const position = Vector3.TransformCoordinates(vertex, worldMatrix)
    const coordPair = vector3ToLatLng(position)
    polygon.push(coordPair)
  }

  meshPolygonCache.set(mesh, polygon)
  return polygon
}
