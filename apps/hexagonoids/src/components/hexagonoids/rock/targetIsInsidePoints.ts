import type { Vector3 } from '@babylonjs/core/Maths/math.vector'

export const targetIsInsidePoints = (
  target: Vector3,
  points: Vector3[]
): boolean => {
  // Create a bounding box to surround all the points in the polyhedron
  let minX = Number.MAX_VALUE
  let minY = Number.MAX_VALUE
  let minZ = Number.MAX_VALUE
  let maxX = Number.MIN_VALUE
  let maxY = Number.MIN_VALUE
  let maxZ = Number.MIN_VALUE

  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    minZ = Math.min(minZ, point.z)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
    maxZ = Math.max(maxZ, point.z)
  }

  // Check if the target point is inside the bounding box
  if (
    target.x >= minX &&
    target.x <= maxX &&
    target.y >= minY &&
    target.y <= maxY &&
    target.z >= minZ &&
    target.z <= maxZ
  ) {
    return true
  }

  return false
}
