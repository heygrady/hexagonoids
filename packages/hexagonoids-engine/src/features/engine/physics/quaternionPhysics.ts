import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'

import { RADIUS } from '../constants.js'

/**
 * Get world position from a rotation quaternion.
 * Applies the quaternion to the "up" vector to find the surface point.
 */
export const getPositionFromQuaternion = (
  rotationQuaternion: Quaternion,
  radius: number = RADIUS
): Vector3 => {
  const up = Vector3.Up()
  const position = up.applyRotationQuaternion(rotationQuaternion)
  return position.scale(radius)
}

/**
 * Integrate angular velocity to update rotation quaternion.
 * Uses LEFT multiplication (Delta * Current) because angularVelocity is in world space.
 *
 * @param deltaTime - Time delta in **seconds** (not milliseconds).
 */
export const integrateAngularVelocity = (
  currentRotation: Quaternion,
  angularVelocity: Vector3,
  deltaTime: number
): Quaternion => {
  const speed = angularVelocity.length()

  if (speed < 0.00001) {
    return currentRotation
  }

  const angle = speed * deltaTime
  const axis = angularVelocity.scale(1 / speed)
  const frameRotation = Quaternion.RotationAxis(axis, angle)

  // LEFT multiplication: world-space angular velocity
  const result = frameRotation.multiply(currentRotation)
  result.normalize()
  return result
}

/**
 * Apply friction (exponential decay) to angular velocity.
 * Frame-rate independent: omega' = omega * exp(-friction * dt)
 *
 * @param deltaTime - Time delta in **seconds** (not milliseconds).
 */
export const applyAngularFriction = (
  angularVelocity: Vector3,
  frictionCoefficient: number,
  deltaTime: number
): Vector3 => {
  const dampingFactor = Math.exp(-frictionCoefficient * deltaTime)
  return angularVelocity.scale(dampingFactor)
}

/**
 * Clamp angular velocity magnitude to a maximum speed.
 */
export const clampAngularVelocity = (
  angularVelocity: Vector3,
  maxSpeed: number
): Vector3 => {
  const currentSpeed = angularVelocity.length()
  if (currentSpeed > maxSpeed && currentSpeed > 0.00001) {
    return angularVelocity.scale(maxSpeed / currentSpeed)
  }
  return angularVelocity
}

/**
 * Convert a local heading to world-space angular velocity.
 * Transforms a heading angle in the tangent plane into an angular velocity vector.
 */
export const headingToAngularVelocity = (
  positionQuaternion: Quaternion,
  localHeading: number,
  speed: number
): Vector3 => {
  if (speed < 0.00001) {
    return Vector3.Zero()
  }

  const worldUp = Vector3.Up().applyRotationQuaternion(positionQuaternion)

  const localHeadingRotation = Quaternion.RotationAxis(
    Vector3.Up(),
    localHeading
  )
  const localHeading3D =
    Vector3.Forward().applyRotationQuaternion(localHeadingRotation)
  const worldHeading =
    localHeading3D.applyRotationQuaternion(positionQuaternion)

  const rotationAxis = Vector3.Cross(worldUp, worldHeading)
  const axisLen = rotationAxis.length()
  if (axisLen < 0.00001) {
    return Vector3.Zero()
  }

  rotationAxis.scaleInPlace(1 / axisLen)
  return rotationAxis.scale(speed)
}
