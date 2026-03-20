import type { Quat, Vec3 } from '../math/types.js'
import { vec3Set } from '../math/vec3.js'

/**
 * Integrate angular velocity to update rotation quaternion in place.
 * Uses LEFT multiplication (Delta * Current) because angularVelocity is in world space.
 *
 * @param deltaTime - Time delta in **seconds** (not milliseconds).
 */
export const integrateAngularVelocity = (
  currentRotation: Quat,
  angularVelocity: Vec3,
  deltaTime: number
): void => {
  const wx = angularVelocity[0]
  const wy = angularVelocity[1]
  const wz = angularVelocity[2]
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

  const qx = currentRotation[0]
  const qy = currentRotation[1]
  const qz = currentRotation[2]
  const qw = currentRotation[3]

  const rx = dw * qx + dx * qw + dy * qz - dz * qy
  const ry = dw * qy - dx * qz + dy * qw + dz * qx
  const rz = dw * qz + dx * qy - dy * qx + dz * qw
  const rw = dw * qw - dx * qx - dy * qy - dz * qz

  const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz + rw * rw)
  if (rLen < 0.00001) {
    return
  }

  const invLen = 1 / rLen
  currentRotation[0] = rx * invLen
  currentRotation[1] = ry * invLen
  currentRotation[2] = rz * invLen
  currentRotation[3] = rw * invLen
}

/**
 * Apply friction (exponential decay) to angular velocity in place.
 * Frame-rate independent: omega' = omega * exp(-friction * dt)
 *
 * @param deltaTime - Time delta in **seconds** (not milliseconds).
 */
export const applyAngularFriction = (
  angularVelocity: Vec3,
  frictionCoefficient: number,
  deltaTime: number
): void => {
  const dampingFactor = Math.exp(-frictionCoefficient * deltaTime)
  angularVelocity[0] *= dampingFactor
  angularVelocity[1] *= dampingFactor
  angularVelocity[2] *= dampingFactor
}

/**
 * Clamp angular velocity magnitude to a maximum speed in place.
 */
export const clampAngularVelocity = (
  angularVelocity: Vec3,
  maxSpeed: number
): void => {
  const currentSpeed = Math.sqrt(
    angularVelocity[0] * angularVelocity[0] +
      angularVelocity[1] * angularVelocity[1] +
      angularVelocity[2] * angularVelocity[2]
  )
  if (currentSpeed > maxSpeed && currentSpeed > 0.00001) {
    const scale = maxSpeed / currentSpeed
    angularVelocity[0] *= scale
    angularVelocity[1] *= scale
    angularVelocity[2] *= scale
  }
}

/**
 * Convert a local heading to world-space angular velocity.
 * Writes result into `dst`. Zero allocations.
 */
export const headingToAngularVelocity = (
  dst: Vec3,
  positionQuaternion: Quat,
  localHeading: number,
  speed: number
): void => {
  if (speed < 0.00001) {
    vec3Set(dst, 0, 0, 0)
    return
  }

  const qx = positionQuaternion[0]
  const qy = positionQuaternion[1]
  const qz = positionQuaternion[2]
  const qw = positionQuaternion[3]

  // worldUp = rotate (0,1,0) by positionQuaternion
  const upX = 2 * (qx * qy - qz * qw)
  const upY = 1 - 2 * (qx * qx + qz * qz)
  const upZ = 2 * (qy * qz + qx * qw)

  // Local heading direction: rotate (0,0,1) by Y-axis rotation
  const ldx = Math.sin(localHeading)
  const ldy = 0
  const ldz = Math.cos(localHeading)

  // worldHeading = rotate localHeading3D by positionQuaternion
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
    vec3Set(dst, 0, 0, 0)
    return
  }

  const s = speed / axisLen
  dst[0] = ax * s
  dst[1] = ay * s
  dst[2] = az * s
}
