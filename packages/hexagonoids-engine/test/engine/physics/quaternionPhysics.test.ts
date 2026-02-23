import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { describe, expect, it } from 'vitest'

import {
  applyAngularFriction,
  clampAngularVelocity,
  getPositionFromQuaternion,
  headingToAngularVelocity,
  integrateAngularVelocity,
  latLngToVector3,
  quaternionToLatLng,
  vector3ToLatLng,
} from '../../../src/index.js'

describe('getPositionFromQuaternion', () => {
  it('returns (0, radius, 0) for identity quaternion', () => {
    const pos = getPositionFromQuaternion(Quaternion.Identity(), 5)
    expect(pos.x).toBeCloseTo(0, 5)
    expect(pos.y).toBeCloseTo(5, 5)
    expect(pos.z).toBeCloseTo(0, 5)
  })

  it('returns a point on the sphere surface at the correct radius', () => {
    const q = Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2)
    const pos = getPositionFromQuaternion(q, 5)
    expect(pos.length()).toBeCloseTo(5, 5)
  })
})

describe('integrateAngularVelocity', () => {
  it('returns the same quaternion for zero angular velocity', () => {
    const q = Quaternion.Identity()
    const result = integrateAngularVelocity(q, Vector3.Zero(), 1)
    expect(result.x).toBeCloseTo(q.x, 10)
    expect(result.y).toBeCloseTo(q.y, 10)
    expect(result.z).toBeCloseTo(q.z, 10)
    expect(result.w).toBeCloseTo(q.w, 10)
  })

  it('produces orientation change for non-zero angular velocity', () => {
    const q = Quaternion.Identity()
    const omega = new Vector3(0, 0, 1) // rotate around Z axis at 1 rad/s
    const result = integrateAngularVelocity(q, omega, 0.1)
    // Should differ from identity
    expect(
      Math.abs(result.x) + Math.abs(result.y) + Math.abs(result.z)
    ).toBeGreaterThan(0.001)
  })

  it('results in a normalized quaternion', () => {
    const q = Quaternion.Identity()
    const omega = new Vector3(1, 0.5, 0.3)
    const result = integrateAngularVelocity(q, omega, 0.5)
    const len = Math.sqrt(
      result.x ** 2 + result.y ** 2 + result.z ** 2 + result.w ** 2
    )
    expect(len).toBeCloseTo(1, 5)
  })
})

describe('applyAngularFriction', () => {
  it('reduces velocity magnitude by the expected decay factor', () => {
    const v = new Vector3(1, 0, 0)
    const friction = 0.35
    const dt = 1 // 1 second
    const result = applyAngularFriction(v, friction, dt)
    // Expected: exp(-0.35 * 1) ≈ 0.7047
    expect(result.length()).toBeCloseTo(Math.exp(-friction * dt), 5)
  })

  it('returns zero-length vector for zero velocity', () => {
    const v = new Vector3(0, 0, 0)
    const result = applyAngularFriction(v, 0.35, 1)
    expect(result.length()).toBeCloseTo(0, 10)
  })

  it('does not change direction, only magnitude', () => {
    const v = new Vector3(0, 0, 2)
    const result = applyAngularFriction(v, 0.35, 0.016)
    expect(result.x).toBeCloseTo(0, 10)
    expect(result.y).toBeCloseTo(0, 10)
    expect(result.z).toBeGreaterThan(0)
  })
})

describe('clampAngularVelocity', () => {
  it('does not change velocity below max speed', () => {
    const v = new Vector3(0.1, 0, 0)
    const result = clampAngularVelocity(v, 1)
    expect(result.x).toBeCloseTo(0.1, 5)
  })

  it('clamps velocity above max speed', () => {
    const v = new Vector3(2, 0, 0)
    const result = clampAngularVelocity(v, 1)
    expect(result.length()).toBeCloseTo(1, 5)
  })
})

describe('headingToAngularVelocity', () => {
  it('returns zero vector for zero speed', () => {
    const result = headingToAngularVelocity(Quaternion.Identity(), 0, 0)
    expect(result.length()).toBeCloseTo(0, 5)
  })

  it('returns angular velocity with correct magnitude', () => {
    const result = headingToAngularVelocity(Quaternion.Identity(), 0, 1)
    expect(result.length()).toBeCloseTo(1, 3)
  })
})

describe('lat/lng round-trip', () => {
  it('quaternionToLatLng returns (90, 0) for identity quaternion', () => {
    // Identity quaternion → up vector → lat 90, lng 0
    const [lat, lng] = quaternionToLatLng(Quaternion.Identity())
    expect(lat).toBeCloseTo(90, 3)
    expect(lng).toBeCloseTo(0, 3)
  })

  it('vector3ToLatLng and latLngToVector3 round-trip', () => {
    const lat = 30
    const lng = -60
    const v = latLngToVector3(lat, lng, 5)
    const [lat2, lng2] = vector3ToLatLng(v)
    expect(lat2).toBeCloseTo(lat, 3)
    expect(lng2).toBeCloseTo(lng, 3)
  })

  it('latLngToVector3 produces a vector at the correct radius', () => {
    const v = latLngToVector3(45, 90, 10)
    expect(v.length()).toBeCloseTo(10, 5)
  })
})
