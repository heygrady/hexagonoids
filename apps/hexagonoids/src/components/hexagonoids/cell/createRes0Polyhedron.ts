import { CreatePolyhedron } from '@babylonjs/core/Meshes/Builders/polyhedronBuilder'
import type { Mesh, Scene, Vector3 } from '@babylonjs/core/scene'
import { latLngToVector3 } from '@heygrady/h3-babylon'
import {
  type CoordPair,
  cellToLatLng,
  cellToVertexes,
  getRes0Cells,
  vertexToLatLng,
} from 'h3-js'
import qh from 'quickhull3d'

const createGlobe = (points: Vector3[]) => {
  const vertex = points.map((v) => v.asArray())
  const face = qh(vertex)
  return { vertex, face }
}

export const createRes0Polyhedron = (scene: Scene): Mesh => {
  const cells = getRes0Cells()
  const vertexes = cells.map((h) => cellToVertexes(h)).flat()
  const vertexSet = new Set(vertexes)

  const coordPairs = new Set<CoordPair>()
  for (const vertex of vertexSet) {
    coordPairs.add(vertexToLatLng(vertex))
  }
  for (const h of cells) {
    coordPairs.add(cellToLatLng(h))
  }

  const points = new Set<Vector3>()
  for (const [lat, lng] of coordPairs) {
    points.add(latLngToVector3(lat, lng, 1))
  }

  const shape = createGlobe(Array.from(points))
  const polyhedron = CreatePolyhedron(
    'customPolyhedron',
    { custom: shape },
    scene
  )
  return polyhedron
}
