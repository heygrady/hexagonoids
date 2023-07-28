import { Vector2, Vector3 } from '@babylonjs/core'

export const arcDistanceTo = (
  point: Vector2,
  from: Vector2 = new Vector2(0, 1)
): number => {
  const target = point.clone().normalize()

  const dotProduct = Vector2.Dot(from, target)

  // Clamp the dot product to ensure it falls within the valid range [-1, 1]
  const clampedDotProduct = Math.max(-1, Math.min(dotProduct, 1))

  const distance = Math.acos(clampedDotProduct)
  if (target.x < 0) {
    return -distance
  }
  return distance
}

/**
 * Returns the pitch and roll to rotate from the up position to the given point
 * @param point the ending point
 * @returns the pitch and roll to rotate from the up position to the given point
 */
export const getPitchRoll = (point: Vector3): [pitch: number, roll: number] => {
  const up = Vector3.Up()
  const target = point.clone().normalize()
  const roll =
    target.x === 0
      ? 0
      : arcDistanceTo(new Vector2(-target.x, target.y), new Vector2(up.x, up.y))
  const pitch =
    target.z === 0 && target.y > -1
      ? 0
      : arcDistanceTo(new Vector2(target.z, target.y), new Vector2(up.z, up.y))
  return [pitch, roll]
}
