import type { TransformNode } from '@babylonjs/core'

import { RADIUS } from '../constants'

import { getNextPoint } from './getNextPoint'

export const getNextPosition = (
  node: TransformNode,
  heading: number,
  distance: number,
  radius: number = RADIUS
) => {
  const nextPosition = getNextPoint(heading, distance).scaleInPlace(radius)
  node.getDirectionToRef(nextPosition, nextPosition)
  return nextPosition
}

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
