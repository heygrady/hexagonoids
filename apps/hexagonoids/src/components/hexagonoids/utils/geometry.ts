import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import QuickLRU from 'quick-lru'

/**
 * Creates a hexagon with the given radius, with vertices cached for performance.
 * Returns an array of 6 Vector3 vertices forming a regular hexagon.
 * @param {number} radius - Radius of the hexagon
 * @returns {Vector3[]} Array of 6 Vector3 vertices
 */
export const createHexagon = (radius: number): Vector3[] => {
  const hexagonCache = new QuickLRU<number, Vector3[]>({ maxSize: 3 })

  let vertices = hexagonCache.get(radius)
  if (vertices != null) {
    return vertices
  }
  vertices = []

  for (let i = 0; i < 6; i++) {
    const angle = i * (Math.PI / 3)
    const x = radius * Math.cos(angle)
    const z = radius * Math.sin(angle)
    vertices.push(new Vector3(x, 0, z))
  }
  hexagonCache.set(radius, vertices)
  return vertices
}

/**
 * Converts a local vector to world coordinates using the given transform node.
 * @param {Vector3} localVector - Vector in local space
 * @param {TransformNode} node - Transform node that defines the local-to-world transformation
 * @returns {Vector3} Vector in world space
 */
export const localToWorld = (
  localVector: Vector3,
  node: TransformNode
): Vector3 => {
  const worldMatrix = node.computeWorldMatrix(true)
  const worldVector = Vector3.TransformCoordinates(localVector, worldMatrix)
  return worldVector
}
