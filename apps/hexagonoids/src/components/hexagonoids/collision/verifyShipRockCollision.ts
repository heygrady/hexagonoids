import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { vector3ToLatLng } from '@heygrady/h3-babylon'
import { intersection } from 'martinez-polygon-clipping'

import type { CullableEntry } from '../NodeRegistry'
import { ROCK_1, ROCK_2, ROCK_3, ROCK_4 } from '../rock/createRockPolygon'
import { SHIP_POLYGON } from '../ship/createShipPolygon'

type LatLngPair = [lat: number, lng: number]

// Pre-convert Vector2 polygon definitions to Vector3 on the XZ plane (y=0),
// matching PolygonMeshBuilder's coordinate layout.
const SHIP_OUTLINE_3D = SHIP_POLYGON.map((v) => new Vector3(v.x, 0, v.y))

const ROCK_OUTLINES_3D = [
  ROCK_1.map((v) => new Vector3(v.x, 0, v.y)),
  ROCK_2.map((v) => new Vector3(v.x, 0, v.y)),
  ROCK_3.map((v) => new Vector3(v.x, 0, v.y)),
  ROCK_4.map((v) => new Vector3(v.x, 0, v.y)),
]

/**
 * Get the outline vertices for a rock mesh based on its master mesh name.
 * Master meshes are named `rockMaster_0` through `rockMaster_3`.
 */
function getRockOutline(rockMesh: AbstractMesh): Vector3[] {
  // InstancedMesh → sourceMesh; regular mesh uses itself
  const source =
    'sourceMesh' in rockMesh
      ? (rockMesh as { sourceMesh: AbstractMesh }).sourceMesh
      : rockMesh
  const match = source.name.match(/rockMaster_(\d+)/)
  const index = match != null ? parseInt(match[1], 10) : 0
  return ROCK_OUTLINES_3D[index] ?? ROCK_OUTLINES_3D[0]
}

/**
 * Transform local-space outline vertices to lat/lng on the sphere surface
 * using the mesh's current world matrix.
 */
function meshOutlineToLatLng(
  mesh: AbstractMesh,
  localVertices: Vector3[]
): LatLngPair[] {
  const worldMatrix = mesh.getWorldMatrix()
  const result: LatLngPair[] = []
  for (const vertex of localVertices) {
    const worldPos = Vector3.TransformCoordinates(vertex, worldMatrix)
    result.push(vector3ToLatLng(worldPos))
  }
  // Close the polygon ring (martinez expects first === last)
  if (result.length > 0) {
    result.push(result[0])
  }
  return result
}

/**
 * Ray-casting point-in-polygon test.
 * Returns true if the point is inside the polygon.
 */
function isPointInsidePolygon(
  point: LatLngPair,
  polygon: LatLngPair[]
): boolean {
  let inside = false
  const [px, py] = point
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ix, iy] = polygon[i]
    const [jx, jy] = polygon[j]
    if (iy > py !== jy > py && px < ((jx - ix) * (py - iy)) / (jy - iy) + ix) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Check if polygon1 is completely inside polygon2 by testing
 * whether any vertex of polygon1 lies inside polygon2.
 */
function isPolygonInsidePolygon(
  polygon1: LatLngPair[],
  polygon2: LatLngPair[]
): boolean {
  // Test the first vertex — if it's inside, the whole polygon is
  // (we only get here after martinez found no edge intersection)
  return polygon1.length > 0 && isPointInsidePolygon(polygon1[0], polygon2)
}

/**
 * Verify a ship-rock collision using martinez polygon clipping.
 *
 * Projects both mesh outlines to lat/lng on the sphere surface and
 * checks for polygon intersection. This provides precise collision
 * detection for flat polygons on a curved surface, where Babylon's
 * triangle-based `intersectsMesh` is unreliable.
 */
export function verifyShipRockCollision(
  shipEntry: CullableEntry,
  rockEntry: CullableEntry
): boolean {
  const shipMesh = shipEntry.visualNode
  const rockMesh = rockEntry.visualNode

  // Project outline vertices to lat/lng
  const shipPoly = meshOutlineToLatLng(shipMesh, SHIP_OUTLINE_3D)
  const rockPoly = meshOutlineToLatLng(rockMesh, getRockOutline(rockMesh))

  // Degenerate polygon: fewer than 4 points means the outline couldn't be built.
  // Fail-closed — a missing outline is not a collision.
  if (shipPoly.length < 4 || rockPoly.length < 4) return false

  try {
    // Martinez expects [polygon] where polygon is array of rings (closed)
    const result = intersection(
      [shipPoly] as number[][][],
      [rockPoly] as number[][][]
    )

    if (result != null && result.length > 0) {
      return true
    }

    // Fallback: check if one polygon is entirely inside the other
    // (martinez does not report containment as intersection)
    if (
      isPolygonInsidePolygon(shipPoly, rockPoly) ||
      isPolygonInsidePolygon(rockPoly, shipPoly)
    ) {
      return true
    }

    return false
  } catch (err) {
    // Martinez threw on these polygon inputs — log for debugging and allow the
    // collision so the player isn't silently protected by a bug.
    console.warn(
      'verifyShipRockCollision: martinez threw; allowing collision',
      err
    )
    return true
  }
}
