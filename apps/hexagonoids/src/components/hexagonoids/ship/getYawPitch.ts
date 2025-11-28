import { Vector3 } from '@babylonjs/core/Maths/math.vector'

/**
 * Returns the yaw and pitch to rotate from the up position to the given point
 * @param {Vector3} point - the ending point
 * @returns {[number, number]} the yaw and pitch to rotate from the  up position to the given point
 */
export const getYawPitch = (point: Vector3): [yaw: number, pitch: number] => {
  // Calculate the direction vector from the up position to the given point
  const direction = point.clone().normalize().subtract(Vector3.UpReadOnly)

  // Calculate the yaw angle
  const yaw = Math.atan2(direction.x, direction.z)

  // Calculate the pitch angle
  const distance = direction.length()
  const pitch =
    Math.asin(distance / 2) -
    Math.atan2(
      direction.y,
      Math.sqrt(direction.x * direction.x + direction.z * direction.z)
    )

  return [yaw, pitch]
}
