import { Quaternion, Vector3 } from '@babylonjs/core'

import { getNextPoint } from './getNextPoint'
import { getYawPitch } from './getYawPitch'

export type HeadingSpeed = [heading: number, speed: number]

/**
 * Convert a Cartesian vector to angle and magnitude
 * @param velocity
 * @returns Heading in radians and speed in radians
 */
export const vector3ToHeadingSpeed = (velocity: Vector3): HeadingSpeed => {
  const point = velocity.clone()
  point.rotateByQuaternionAroundPointToRef(
    Quaternion.RotationYawPitchRoll(0, 0, Math.PI),
    Vector3.Zero(),
    point
  )
  point.addInPlace(Vector3.Up())
  const [heading, speed] = getYawPitch(point)
  return [-heading, speed]
}

/**
 * Convert heading and speed into a Cartesian vector
 * @param heading Angle of velocity in radians
 * @param speed Magnitude of velocity
 * @returns Cartesian Coords
 */
export const headingSpeedToVector3 = (heading: number, speed: number) => {
  const point = getNextPoint(-heading, speed)
  point.addInPlace(Vector3.Down())
  point.rotateByQuaternionAroundPointToRef(
    Quaternion.RotationYawPitchRoll(0, 0, Math.PI),
    Vector3.Zero(),
    point
  )
  return point
}

/**
 * Accelerates a velocity in a new direction
 * @param heading Current angle of velocity in radians
 * @param speed  Current magnitude of velocity in radians
 * @param angle Additional angle of velocity in radians
 * @param magnitude Additional magnitude of velocity in radians
 */
export const accelerateHeadingSpeed = (
  heading: number,
  speed: number,
  angle: number,
  magnitude: number
) => {
  const velocity = headingSpeedToVector3(heading, speed)
  const acceleration = headingSpeedToVector3(angle, magnitude)
  return vector3ToHeadingSpeed(accelerateVector3(velocity, acceleration))
}

/**
 * Accelerates a velocity in a new direction
 * @param velocity Current velocity as a Vector3
 * @param acceleration  Additional velocity as a Vector3
 */
export const accelerateVector3 = (velocity: Vector3, acceleration: Vector3) => {
  velocity.addInPlace(acceleration)
  return velocity
}

export const applyFrictionHeadingSpeed = (
  heading: number,
  speed: number,
  frictionCoefficient: number
) => {
  const frictionMagnitude = speed * frictionCoefficient
  return [heading, speed - frictionMagnitude]
}

export const applyFrictionVector3 = (
  velocity: Vector3,
  frictionCoefficient: number
) => {
  const [heading, speed] = vector3ToHeadingSpeed(velocity)
  return applyFrictionHeadingSpeed(heading, speed, frictionCoefficient)
}
