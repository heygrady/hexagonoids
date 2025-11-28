import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'

/**
 * Ensures that the radians are wrapped to the range [-2π, 2π]
 * @param {number} radians - radians to wrap
 * @returns {number} radians wrapped to the range [-2π, 2π]
 */
export const wrapRadians = (radians: number): number => {
  const wrapped = radians % (Math.PI * 2)
  return wrapped < -Math.PI
    ? wrapped + Math.PI * 2
    : wrapped > Math.PI
    ? wrapped - Math.PI * 2
    : wrapped
}

/**
 * Ensures that the radians are wrapped to the range [-π, π]
 * Examples:
 * wrapHalfCircle(π) = π
 * wrapHalfCircle(-π) = -π
 * wrapHalfCircle(π * 1.5) = -π / 2
 * @param {number} radians - radians to wrap
 * @returns {number} radians wrapped to the range [-π, π]
 */
export const wrapHalfCircle = (radians: number): number => {
  const wrapped = radians % (Math.PI * 2)

  return wrapped < -Math.PI
    ? wrapped + Math.PI * 2
    : wrapped > Math.PI
    ? wrapped - Math.PI * 2
    : wrapped
}

export const getOrientation = (
  node: TransformNode
): [yaw: number, pitch: number, roll: number] => {
  const euler = Vector3.Zero()
  node.rotationQuaternion?.toEulerAnglesToRef(euler)
  return [euler.y, euler.x, euler.z]
}

export const moveNodeBy = (
  node: TransformNode,
  yaw: number,
  pitch: number,
  roll: number = 0
) => {
  if (node.rotationQuaternion == null) {
    node.rotationQuaternion = Quaternion.Identity()
  }
  node.rotationQuaternion = node.rotationQuaternion.multiply(
    Quaternion.RotationYawPitchRoll(yaw, pitch, roll)
  )
}

export const moveNodeTo = (node: TransformNode, yaw: number, pitch: number) => {
  if (node.rotationQuaternion == null) {
    node.rotationQuaternion = Quaternion.Identity()
  }
  node.rotationQuaternion = Quaternion.RotationYawPitchRoll(yaw, pitch, 0)
}

export const pitchNodeBy = (node: TransformNode, pitch: number) => {
  moveNodeBy(node, 0, pitch)
}

export const turnNodeBy = (node: TransformNode, yaw: number) => {
  moveNodeBy(node, yaw, 0)
}

export const turnNodeTo = (node: TransformNode, yaw: number) => {
  moveNodeTo(node, yaw, 0)
}
