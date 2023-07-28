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

// const getPlaneNormalFromSphere = (
//   sphereCenter: Vector3,
//   pointA: Vector3,
//   pointB: Vector3
// ): Vector3 => {
//   const vectorA = pointA.subtract(sphereCenter)
//   const vectorB = pointB.subtract(sphereCenter)
//   const planeNormal = Vector3.Cross(vectorA, vectorB).normalize()

//   return planeNormal
// }

// const pointAt = (pointA: Vector3, pointB: Vector3, t: number = 0) => {
//   const dirA = pointA.normalize()
//   const dirB = pointB.normalize()

//   const greatCircleNormal = Vector3.Cross(dirA, dirB).normalize()
//   const rotationA = Quaternion.FromLookDirectionLH(dirA, greatCircleNormal)
//   const rotationB = Quaternion.FromLookDirectionLH(dirB, greatCircleNormal)

//   const pathT = t
//   const rotation = Quaternion.Slerp(rotationA, rotationB, pathT)
//   const unitPathPoint = Vector3.Forward().rotateByQuaternionToRef(
//     rotation,
//     new Vector3()
//   )
//   return unitPathPoint.scaleInPlace(RADIUS)
// }
