import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'

import { RADIUS } from '../constants'

/**
 * Quaternion-based spherical physics for objects on a sphere.
 *
 * Model: Sphere rotates on a frictionless pivot at its center.
 * Objects are stationary points on the sphere surface.
 * Velocity is represented as angular velocity vector ω (axis of rotation × magnitude).
 *
 * Physics:
 * - Position = where rotationQuaternion rotates the "up" vector to point
 * - Velocity = angular velocity vector ω (3D vector, not heading/speed)
 * - Movement = quaternion integration: Q(t+dt) = exp(ω*dt/2) * Q(t)
 * - Acceleration = thrust in tangent space, converted to angular acceleration
 */

/**
 * Get world position from a rotation quaternion.
 * @param {Quaternion} rotationQuaternion - Quaternion representing rotation on sphere
 * @param {number} [radius] - Sphere radius
 * @returns {Vector3} Position in world space (at sphere surface)
 */
export const getPositionFromQuaternion = (
  rotationQuaternion: Quaternion,
  radius: number = RADIUS
): Vector3 => {
  const up = Vector3.Up()
  const rotationMatrix = rotationQuaternion.toRotationMatrix()
  return Vector3.TransformCoordinates(up, rotationMatrix).scale(radius)
}

/**
 * Integrate angular velocity to update rotation quaternion.
 * Uses simple Euler integration with world-space angular velocity.
 *
 * CRITICAL: Uses LEFT multiplication (Delta * Current) because angularVelocity is in World Space.
 * This ensures proper spherical motion following great circle paths.
 * @param {Quaternion} currentRotation - Current rotation quaternion (position on sphere)
 * @param {Vector3} angularVelocity - ω: angular velocity vector in world space (rad/s)
 * @param {number} deltaTime - Time step in seconds
 * @returns {Quaternion} Updated rotation quaternion
 */
export const integrateAngularVelocity = (
  currentRotation: Quaternion,
  angularVelocity: Vector3,
  deltaTime: number
): Quaternion => {
  const speed = angularVelocity.length()

  // Safety threshold: don't integrate if speed is very small
  if (speed < 0.00001) {
    return currentRotation
  }

  // Rotation angle for this frame
  const angle = speed * deltaTime

  // Normalize axis explicitly using division (more stable than .normalize())
  const axis = angularVelocity.scale(1 / speed)

  // Rotation as quaternion from world-space axis and angle
  const frameRotation = Quaternion.RotationAxis(axis, angle)

  // Apply rotation: new_position = frameRotation * old_position
  // LEFT multiplication because angularVelocity is in World Space
  return frameRotation.multiply(currentRotation)
}

/**
 * Get velocity in tangent space at current position.
 * For debugging/visualization: converts ω back to a tangent vector.
 * @param {Vector3} angularVelocity - ω: angular velocity vector
 * @param {Vector3} currentPosition - Position on sphere (world space)
 * @returns {Vector3} Velocity as a 3D tangent vector at current position
 */
export const getAngularVelocityAsTangent = (
  angularVelocity: Vector3,
  currentPosition: Vector3
): Vector3 => {
  // v = ω × r (cross product)
  return Vector3.Cross(angularVelocity, currentPosition)
}

/**
 * Convert tangential force to angular acceleration.
 * F_tangent = I * α, simplified for point mass on sphere: ω' = F_tangent / r
 * @param {Vector3} tangentialForce - Force applied tangent to sphere
 * @param {number} [radius] - Sphere radius
 * @returns {Vector3} Angular acceleration (change in ω)
 */
export const tangentialForceToAngularAccel = (
  tangentialForce: Vector3,
  radius: number = RADIUS
): Vector3 => {
  // τ = r × F, and τ = I*α
  // For sphere: τ = α * r², so α = τ / r² = (r × F) / r²
  return tangentialForce.scale(1 / (radius * radius))
}

/**
 * Apply tangential thrust to angular velocity.
 * Thrust is applied perpendicular to current surface (tangent space).
 * @param {Vector3} currentAngularVelocity - Current ω
 * @param {Vector3} thrustDirection - Direction of thrust (normalized, world space)
 * @param {number} thrustMagnitude - Magnitude of thrust
 * @param {Vector3} currentPosition - Current position on sphere (world space)
 * @param {number} deltaTime - Time step
 * @param {number} [radius] - Sphere radius
 * @returns {Vector3} Updated angular velocity
 */
export const applyTangentialThrust = (
  currentAngularVelocity: Vector3,
  thrustDirection: Vector3,
  thrustMagnitude: number,
  currentPosition: Vector3,
  deltaTime: number,
  radius: number = RADIUS
): Vector3 => {
  if (thrustMagnitude === 0) {
    return currentAngularVelocity
  }

  // Remove radial component of thrust (keep only tangential)
  const radialComponent = Vector3.Dot(
    thrustDirection,
    currentPosition.normalize()
  )
  const tangentialDir = thrustDirection.subtract(
    currentPosition.normalize().scale(radialComponent)
  )
  tangentialDir.normalize()

  // Convert to angular acceleration
  const tangentialForce = tangentialDir.scale(thrustMagnitude)
  const angularAccel = tangentialForceToAngularAccel(tangentialForce, radius)

  // Apply: ω' = ω + α*dt
  return currentAngularVelocity.add(angularAccel.scale(deltaTime))
}

/**
 * Apply friction (air resistance) to angular velocity.
 * Uses exponential decay for frame-rate independence.
 * ω' = ω * exp(-frictionCoeff * dt)
 * @param {Vector3} angularVelocity - Current ω
 * @param {number} frictionCoefficient - Friction coefficient (exponential decay rate)
 * @param {number} deltaTime - Time step in seconds
 * @returns {Vector3} Updated angular velocity
 */
export const applyAngularFriction = (
  angularVelocity: Vector3,
  frictionCoefficient: number,
  deltaTime: number
): Vector3 => {
  // Exponential decay is frame-rate independent
  const dampingFactor = Math.exp(-frictionCoefficient * deltaTime)
  return angularVelocity.scale(dampingFactor)
}

/**
 * Clamp angular velocity magnitude to a maximum speed.
 * Uses ratio scaling to avoid re-normalizing issues.
 * @param {Vector3} angularVelocity - Current ω vector
 * @param {number} maxSpeed - Maximum speed in rad/s
 * @returns {Vector3} Clamped angular velocity
 */
export const clampAngularVelocity = (
  angularVelocity: Vector3,
  maxSpeed: number
): Vector3 => {
  const currentSpeed = angularVelocity.length()
  if (currentSpeed > maxSpeed && currentSpeed > 0.00001) {
    // Scale by ratio to maintain direction
    return angularVelocity.scale(maxSpeed / currentSpeed)
  }
  return angularVelocity
}

/**
 * Convert a local heading to world-space angular velocity.
 * This transforms a heading (tangent-plane angle) into an angular velocity vector
 * that represents rotation around the sphere center.
 *
 * The object is conceptually at (0, 1, 0) in local space.
 * Forward is (0, 0, 1) in local space.
 * Heading rotates the forward direction around local Y axis.
 * @param {Quaternion} positionQuaternion - Quaternion encoding object's position on sphere
 * @param {number} localHeading - Heading in radians (0 to 2π) in local tangent space
 * @param {number} speed - Magnitude of angular velocity (rad/s)
 * @returns {Vector3} Angular velocity vector ω in world space
 */
export const headingToAngularVelocity = (
  positionQuaternion: Quaternion,
  localHeading: number,
  speed: number
): Vector3 => {
  if (speed < 0.00001) {
    return Vector3.Zero()
  }

  // Get world up (current position on sphere surface)
  const worldUp = Vector3.Up().applyRotationQuaternion(positionQuaternion)

  // Calculate heading in local space: rotate forward by localHeading around Y
  const localHeadingRotation = Quaternion.RotationAxis(
    Vector3.Up(),
    localHeading
  )
  const localHeading3D =
    Vector3.Forward().applyRotationQuaternion(localHeadingRotation)

  // Transform local heading to world space
  const worldHeading =
    localHeading3D.applyRotationQuaternion(positionQuaternion)

  // Calculate rotation axis: worldUp × worldHeading
  // This is the axis around which the sphere must rotate to move forward
  const rotationAxis = Vector3.Cross(worldUp, worldHeading)

  // Safety check: ensure we don't have a degenerate vector
  const axisLen = rotationAxis.length()
  if (axisLen < 0.00001) {
    // Degenerate case - vectors are parallel
    return Vector3.Zero()
  }

  // Normalize and scale by speed
  rotationAxis.scaleInPlace(1 / axisLen)
  return rotationAxis.scale(speed)
}
