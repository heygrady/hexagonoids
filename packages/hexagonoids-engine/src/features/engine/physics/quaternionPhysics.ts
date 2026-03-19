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
 * Fast scalar variant of integrateAngularVelocity.
 * Matches integrateAngularVelocity semantics with reduced allocations.
 */
export const integrateAngularVelocityFast = (
  currentRotation: Quaternion,
  angularVelocity: Vector3,
  deltaTime: number
): Quaternion => {
  const next = currentRotation.clone()
  integrateAngularVelocityFastInPlace(next, angularVelocity, deltaTime)
  return next
}

/**
 * Fast scalar integration that mutates the provided quaternion in place.
 * This avoids per-tick allocation in hot movement loops.
 */
export const integrateAngularVelocityFastInPlace = (
  currentRotation: Quaternion,
  angularVelocity: Vector3,
  deltaTime: number
): void => {
  const wx = angularVelocity.x
  const wy = angularVelocity.y
  const wz = angularVelocity.z
  const speed = Math.sqrt(wx * wx + wy * wy + wz * wz)

  if (speed < 0.00001) {
    return
  }

  const angle = speed * deltaTime
  const halfAngle = angle * 0.5
  const sinHalf = Math.sin(halfAngle)
  const cosHalf = Math.cos(halfAngle)
  const k = sinHalf / speed

  // Delta quaternion (world-space axis-angle), left-multiplied.
  const dx = wx * k
  const dy = wy * k
  const dz = wz * k
  const dw = cosHalf

  const qx = currentRotation.x
  const qy = currentRotation.y
  const qz = currentRotation.z
  const qw = currentRotation.w

  const rx = dw * qx + dx * qw + dy * qz - dz * qy
  const ry = dw * qy - dx * qz + dy * qw + dz * qx
  const rz = dw * qz + dx * qy - dy * qx + dz * qw
  const rw = dw * qw - dx * qx - dy * qy - dz * qz

  const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz + rw * rw)
  if (rLen < 0.00001) {
    return
  }

  const invLen = 1 / rLen
  currentRotation.x = rx * invLen
  currentRotation.y = ry * invLen
  currentRotation.z = rz * invLen
  currentRotation.w = rw * invLen
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
 *
 * Pure scalar math — zero BabylonJS allocations. Returns a Vector3 for API
 * compatibility, but all computation uses raw x/y/z/w locals.
 */
export const headingToAngularVelocity = (
  positionQuaternion: Quaternion,
  localHeading: number,
  speed: number
): Vector3 => {
  if (speed < 0.00001) {
    return Vector3.Zero()
  }

  const qx = positionQuaternion.x
  const qy = positionQuaternion.y
  const qz = positionQuaternion.z
  const qw = positionQuaternion.w

  // worldUp = rotate (0,1,0) by positionQuaternion
  const upX = 2 * (qx * qy - qz * qw)
  const upY = 1 - 2 * (qx * qx + qz * qz)
  const upZ = 2 * (qy * qz + qx * qw)

  // Local heading direction: rotate (0,0,1) by Y-axis rotation
  // = (sin(heading), 0, cos(heading))
  const ldx = Math.sin(localHeading)
  const ldy = 0
  const ldz = Math.cos(localHeading)

  // worldHeading = rotate localHeading3D by positionQuaternion
  // v' = q * v * q^-1, expanded for unit quaternion:
  // t = 2 * cross(q.xyz, v)
  // v' = v + q.w * t + cross(q.xyz, t)
  const tx = 2 * (qy * ldz - qz * ldy)
  const ty = 2 * (qz * ldx - qx * ldz)
  const tz = 2 * (qx * ldy - qy * ldx)

  const whx = ldx + qw * tx + (qy * tz - qz * ty)
  const why = ldy + qw * ty + (qz * tx - qx * tz)
  const whz = ldz + qw * tz + (qx * ty - qy * tx)

  // rotationAxis = cross(worldUp, worldHeading)
  const ax = upY * whz - upZ * why
  const ay = upZ * whx - upX * whz
  const az = upX * why - upY * whx

  const axisLen = Math.sqrt(ax * ax + ay * ay + az * az)
  if (axisLen < 0.00001) {
    return Vector3.Zero()
  }

  const scale = speed / axisLen
  return new Vector3(ax * scale, ay * scale, az * scale)
}
