import { Quaternion, Vector3 } from '@babylonjs/core'

import { wrapHalfCircle } from './orientation'

/**
 * Returns a new point on the sphere that is pitch distance in yaw direction from the up position, facing forward
 * @param direction yaw rotation
 * @param distance pitch distance
 * @returns new point on the sphere that is pitch distance in yaw direction from the up position
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
 * @param distance pitch distance
 * @returns new point on the sphere that is pitch distance from the up position
 */
export const getForwardPoint = (distance: number): Vector3 =>
  getNextPoint(0, distance)
