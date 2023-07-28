import { Vector2 } from '@babylonjs/core/Maths/math.vector'

const isConvex = (
  previousVertex: Vector2,
  currentVertex: Vector2,
  nextVertex: Vector2
): boolean => {
  return (
    previousVertex.x * (nextVertex.y - currentVertex.y) +
      currentVertex.x * (previousVertex.y - nextVertex.y) +
      nextVertex.x * (currentVertex.y - previousVertex.y) <
    0
  )
}

/**
 * Creates a mapping function for converting an array of vertices into proper border vertices at the given distance.
 *
 * Usage:
 * ```
 * // Vertex array should have at least 3 vertices.
 * const rockVertices: Vector2[] = [new Vector2(0, 0), new Vector2(1, 1), new Vector2(2, 0)]
 *
 * const borderVertices = rockVertices.map(getBorderVertex(2))
 * ```
 * @param distance
 * @returns a mapping function that returns a border vertex for a given vertex
 */
export const getBorderVertex =
  (distance: number) =>
  (currentVertex: Vector2, index: number, array: Vector2[]): Vector2 => {
    const previousVertex =
      index === 0 ? array[array.length - 1] : array[index - 1]
    const nextVertex = index === array.length - 1 ? array[0] : array[index + 1]

    const line1 = currentVertex.subtract(previousVertex)
    const line2 = currentVertex.subtract(nextVertex)

    line1.normalize()
    line2.normalize()

    const dotProduct = Vector2.Dot(line1, line2)
    if (dotProduct === 1 || dotProduct === -1) {
      const normalVector = new Vector2(line1.y, -line1.x)
      normalVector.scaleInPlace(distance)
      return currentVertex.add(normalVector)
    }

    const halfwayLine = line1.add(line2)

    // FIXME: what about negative distances?
    const convex = isConvex(previousVertex, currentVertex, nextVertex)
    const invert =
      (!convex && Math.sign(distance) >= 0) ||
      (convex && Math.sign(distance) < 0)
    if (invert) {
      halfwayLine.scaleInPlace(-1)
    }

    halfwayLine.normalize()
    halfwayLine.scaleInPlace(distance)
    return currentVertex.add(halfwayLine)
  }
