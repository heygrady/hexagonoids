import { describe, expect, it } from 'vitest'
import {
  quatIdentity,
  vec3,
  vec3Zero,
} from '../../../src/features/engine/math/create.js'
import {
  quatFromAxisAngle,
  quatToUnitPoint,
} from '../../../src/features/engine/math/quat.js'
import type { Quat } from '../../../src/features/engine/math/types.js'
import { vec3Length } from '../../../src/features/engine/math/vec3.js'
import {
  latLngToQuaternion,
  latLngToVec3,
  quaternionToLatLng,
  quaternionToLatLngFast,
  vec3ToLatLng,
} from '../../../src/features/engine/physics/latLng.js'
import {
  applyAngularFriction,
  clampAngularVelocity,
  headingToAngularVelocity,
  integrateAngularVelocity,
} from '../../../src/index.js'

describe('quatToUnitPoint (replaces getPositionFromQuaternion)', () => {
  it('returns (0, 1, 0) for identity quaternion', () => {
    const dst = vec3Zero()
    quatToUnitPoint(dst, quatIdentity())
    expect(dst[0]).toBeCloseTo(0, 5)
    expect(dst[1]).toBeCloseTo(1, 5)
    expect(dst[2]).toBeCloseTo(0, 5)
  })

  it('returns a unit point on the sphere surface', () => {
    const axis = vec3(1, 0, 0)
    const q = new Float64Array(4) as Quat
    quatFromAxisAngle(q, axis, Math.PI / 2)
    const dst = vec3Zero()
    quatToUnitPoint(dst, q)
    expect(vec3Length(dst)).toBeCloseTo(1, 5)
  })
})

describe('integrateAngularVelocity', () => {
  it('does not change quaternion for zero angular velocity', () => {
    const q = quatIdentity()
    const qxBefore = q[0]
    const qyBefore = q[1]
    const qzBefore = q[2]
    const qwBefore = q[3]
    integrateAngularVelocity(q, vec3Zero(), 1)
    expect(q[0]).toBeCloseTo(qxBefore, 10)
    expect(q[1]).toBeCloseTo(qyBefore, 10)
    expect(q[2]).toBeCloseTo(qzBefore, 10)
    expect(q[3]).toBeCloseTo(qwBefore, 10)
  })

  it('produces orientation change for non-zero angular velocity', () => {
    const q = quatIdentity()
    const omega = vec3(0, 0, 1) // rotate around Z axis at 1 rad/s
    integrateAngularVelocity(q, omega, 0.1)
    // Should differ from identity
    expect(Math.abs(q[0]) + Math.abs(q[1]) + Math.abs(q[2])).toBeGreaterThan(
      0.001
    )
  })

  it('results in a normalized quaternion', () => {
    const q = quatIdentity()
    const omega = vec3(1, 0.5, 0.3)
    integrateAngularVelocity(q, omega, 0.5)
    const len = Math.sqrt(q[0] ** 2 + q[1] ** 2 + q[2] ** 2 + q[3] ** 2)
    expect(len).toBeCloseTo(1, 5)
  })

  it('integrator produces consistent results across representative states', () => {
    const scenarios = [
      {
        q: quatIdentity(),
        omega: vec3(0.5, 0.1, -0.2),
        dt: 0.016,
      },
      {
        q: latLngToQuaternion(32, -74),
        omega: vec3(-0.3, 0.4, 0.15),
        dt: 0.1,
      },
      {
        q: latLngToQuaternion(-68, 121),
        omega: vec3(0.2, -0.6, 0.45),
        dt: 0.033,
      },
    ]

    for (const { q, omega, dt } of scenarios) {
      // Clone q so we can compare
      const qBefore = new Float64Array(q) as Quat
      integrateAngularVelocity(q, omega, dt)
      // q should have changed
      const changed =
        Math.abs(q[0] - qBefore[0]) > 1e-10 ||
        Math.abs(q[1] - qBefore[1]) > 1e-10 ||
        Math.abs(q[2] - qBefore[2]) > 1e-10 ||
        Math.abs(q[3] - qBefore[3]) > 1e-10
      expect(changed).toBe(true)
      // Result should be normalized
      const len = Math.sqrt(q[0] ** 2 + q[1] ** 2 + q[2] ** 2 + q[3] ** 2)
      expect(len).toBeCloseTo(1, 6)
    }
  })
})

describe('applyAngularFriction', () => {
  it('reduces velocity magnitude by the expected decay factor', () => {
    const v = vec3(1, 0, 0)
    const friction = 0.35
    const dt = 1 // 1 second
    applyAngularFriction(v, friction, dt)
    // Expected: exp(-0.35 * 1) ~ 0.7047
    expect(vec3Length(v)).toBeCloseTo(Math.exp(-friction * dt), 5)
  })

  it('keeps zero-length vector at zero', () => {
    const v = vec3(0, 0, 0)
    applyAngularFriction(v, 0.35, 1)
    expect(vec3Length(v)).toBeCloseTo(0, 10)
  })

  it('does not change direction, only magnitude', () => {
    const v = vec3(0, 0, 2)
    applyAngularFriction(v, 0.35, 0.016)
    expect(v[0]).toBeCloseTo(0, 10)
    expect(v[1]).toBeCloseTo(0, 10)
    expect(v[2]).toBeGreaterThan(0)
  })
})

describe('clampAngularVelocity', () => {
  it('does not change velocity below max speed', () => {
    const v = vec3(0.1, 0, 0)
    clampAngularVelocity(v, 1)
    expect(v[0]).toBeCloseTo(0.1, 5)
  })

  it('clamps velocity above max speed', () => {
    const v = vec3(2, 0, 0)
    clampAngularVelocity(v, 1)
    expect(vec3Length(v)).toBeCloseTo(1, 5)
  })
})

describe('headingToAngularVelocity', () => {
  it('returns zero vector for zero speed', () => {
    const dst = vec3Zero()
    headingToAngularVelocity(dst, quatIdentity(), 0, 0)
    expect(vec3Length(dst)).toBeCloseTo(0, 5)
  })

  it('returns angular velocity with correct magnitude', () => {
    const dst = vec3Zero()
    headingToAngularVelocity(dst, quatIdentity(), 0, 1)
    expect(vec3Length(dst)).toBeCloseTo(1, 3)
  })
})

describe('lat/lng round-trip', () => {
  it('quaternionToLatLng returns (90, 0) for identity quaternion', () => {
    // Identity quaternion -> up vector -> lat 90, lng 0
    const [lat, lng] = quaternionToLatLng(quatIdentity())
    expect(lat).toBeCloseTo(90, 3)
    expect(lng).toBeCloseTo(0, 3)
  })

  it('vec3ToLatLng and latLngToVec3 round-trip', () => {
    const lat = 30
    const lng = -60
    const v = latLngToVec3(lat, lng, 5)
    const [lat2, lng2] = vec3ToLatLng(v)
    expect(lat2).toBeCloseTo(lat, 3)
    expect(lng2).toBeCloseTo(lng, 3)
  })

  it('latLngToVec3 produces a vector at the correct radius', () => {
    const v = latLngToVec3(45, 90, 10)
    expect(vec3Length(v)).toBeCloseTo(10, 5)
  })

  it('latLngToQuaternion aligns forward with geographic east at non-zero longitude', () => {
    const lat = 0
    const lng = 45
    const q = latLngToQuaternion(lat, lng)

    // Rotate local forward (0,0,1) by q
    const qx = q[0],
      qy = q[1],
      qz = q[2],
      qw = q[3]
    // t = 2 * cross(q_xyz, (0,0,1))
    const tx = 2 * (qy * 1 - qz * 0)
    const ty = 2 * (qz * 0 - qx * 1)
    const tz = 2 * (qx * 0 - qy * 0)
    let wfx = 0 + qw * tx + (qy * tz - qz * ty)
    let wfy = 0 + qw * ty + (qz * tx - qx * tz)
    let wfz = 1 + qw * tz + (qx * ty - qy * tx)
    const fLen = Math.sqrt(wfx * wfx + wfy * wfy + wfz * wfz)
    if (fLen > 1e-7) {
      wfx /= fLen
      wfy /= fLen
      wfz /= fLen
    }

    const lngRad = (lng * Math.PI) / 180
    const eastX = -Math.sin(lngRad)
    const eastY = 0
    const eastZ = Math.cos(lngRad)

    const dot = wfx * eastX + wfy * eastY + wfz * eastZ
    expect(dot).toBeCloseTo(1, 6)
  })

  it('latLngToQuaternion keeps up aligned to the surface normal', () => {
    const lat = 30
    const lng = -120
    const q = latLngToQuaternion(lat, lng)

    // Rotate local up (0,1,0) by q
    const worldUp = vec3Zero()
    quatToUnitPoint(worldUp, q)

    // Expected up = latLngToVec3 at radius 1, normalized
    const expectedUp = latLngToVec3(lat, lng, 1)
    const eLen = vec3Length(expectedUp)
    if (eLen > 1e-7) {
      expectedUp[0] /= eLen
      expectedUp[1] /= eLen
      expectedUp[2] /= eLen
    }

    const dot =
      worldUp[0] * expectedUp[0] +
      worldUp[1] * expectedUp[1] +
      worldUp[2] * expectedUp[2]
    expect(dot).toBeCloseTo(1, 6)
  })

  it('quaternionToLatLngFast matches quaternionToLatLng', () => {
    const quaternions = [
      quatIdentity(),
      latLngToQuaternion(0, 0),
      latLngToQuaternion(45, 10),
      latLngToQuaternion(-35, 130),
      latLngToQuaternion(80, -150),
    ]

    for (const q of quaternions) {
      const [latA, lngA] = quaternionToLatLng(q)
      const [latB, lngB] = quaternionToLatLngFast(q)
      expect(latB).toBeCloseTo(latA, 6)
      expect(lngB).toBeCloseTo(lngA, 6)
    }
  })
})
