import type { Vector3 } from '@babylonjs/core'
import { latLngToVector3 } from '@heygrady/h3-babylon'
import {
  type CoordPair,
  cellToVertexes,
  getRes0Cells,
  vertexToLatLng,
  cellToLatLng,
} from 'h3-js'
import qh from 'quickhull3d'
import { describe, expect, test } from 'vitest'

const createGlobe = (points: Vector3[]) => {
  const vertex = points.map((v) => v.asArray())
  const face = qh(vertex)
  return { vertex, face }
}

describe('h3', () => {
  test('cells share vertices', () => {
    // get all res 0 cells
    const cells = getRes0Cells()
    const vertexes = cells.map((h) => cellToVertexes(h)).flat()
    const vertexSet = new Set(vertexes)

    expect(vertexes.length).toBeGreaterThan(vertexSet.size)

    const coordPairs = new Set<CoordPair>()
    for (const vertex of vertexSet) {
      coordPairs.add(vertexToLatLng(vertex))
    }
    for (const h of cells) {
      coordPairs.add(cellToLatLng(h))
    }

    expect(coordPairs.size).toBe(vertexSet.size + cells.length)

    const points = new Set<Vector3>()
    for (const [lat, lng] of coordPairs) {
      points.add(latLngToVector3(lat, lng, 1))
    }

    expect(points.size).toBe(coordPairs.size)

    const shape = createGlobe(Array.from(points))

    expect(shape.vertex.length).toBe(points.size)

    // console.log(JSON.stringify(shape))

    // const polyhedron = MeshBuilder.CreatePolyhedron(
    //   'customPolyhedron',
    //   { custom: shape },
    //   scene
    // )
  })
})
