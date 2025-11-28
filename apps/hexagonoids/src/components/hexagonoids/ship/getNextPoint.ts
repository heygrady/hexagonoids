import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'

import { wrapHalfCircle } from './orientation'

/**
 * Returns a new point on the sphere that is pitch distance in yaw direction from the up position, facing forward
 * @param {number} direction - yaw rotation
 * @param {number} distance - pitch distance
 * @returns {Vector3} new point on the sphere that is pitch distance in yaw direction from the up position
 */
export const getNextPoint = (direction: number, distance: number): Vector3 => {
  const rotationQuaternion = Quaternion.RotationYawPitchRoll(
    wrapHalfCircle(direction),
    wrapHalfCircle(distance),
    0
  )
  const nextPosition = Vector3.Up()
  nextPosition.rotateByQuaternionAroundPointToRef(
    rotationQuaternion,
    Vector3.Zero(),
    nextPosition
  )
  return nextPosition.normalize()
}

/**
 * Returns a new point on the sphere that is pitch distance from the up position, facing forward
 * @param {number} distance - pitch distance
 * @returns {Vector3} new point on the sphere that is pitch distance from the up position
 */
export const getForwardPoint = (distance: number): Vector3 =>
  getNextPoint(0, distance)
