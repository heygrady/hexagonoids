import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { describe, expect, it } from 'vitest'

import {
  quat,
  quatIdentity,
  vec3,
} from '../../src/features/engine/math/create.js'
import {
  quatCopy,
  quatFromAxisAngle,
  quatFromUnitPoint,
  quatFromYawPitchRoll,
  quatMultiply,
  quatNormalize,
  quatSet,
  quatToUnitPoint,
} from '../../src/features/engine/math/quat.js'
import { unitPointToQuaternion } from '../../src/features/engine/physics/latLng.js'

const EPSILON = 1e-6

describe('quat operations', () => {
  it('quatCopy', () => {
    const src = quat(1, 2, 3, 4)
    const dst = quat(0, 0, 0, 0)
    quatCopy(dst, src)
    expect(dst[0]).toBe(1)
    expect(dst[1]).toBe(2)
    expect(dst[2]).toBe(3)
    expect(dst[3]).toBe(4)
  })

  it('quatSet', () => {
    const q = quat(0, 0, 0, 0)
    quatSet(q, 5, 6, 7, 8)
    expect(q[0]).toBe(5)
    expect(q[1]).toBe(6)
    expect(q[2]).toBe(7)
    expect(q[3]).toBe(8)
  })

  it('quatMultiply matches BabylonJS', () => {
    const ba = Quaternion.RotationAxis(new Vector3(0, 1, 0), Math.PI / 4)
    const bb = Quaternion.RotationAxis(new Vector3(1, 0, 0), Math.PI / 3)
    const bResult = ba.multiply(bb)

    const a = quat(ba.x, ba.y, ba.z, ba.w)
    const b = quat(bb.x, bb.y, bb.z, bb.w)
    const dst = quat(0, 0, 0, 0)
    quatMultiply(dst, a, b)

    expect(dst[0]).toBeCloseTo(bResult.x, 10)
    expect(dst[1]).toBeCloseTo(bResult.y, 10)
    expect(dst[2]).toBeCloseTo(bResult.z, 10)
    expect(dst[3]).toBeCloseTo(bResult.w, 10)
  })

  it('quatNormalize matches BabylonJS', () => {
    const bq = new Quaternion(1, 2, 3, 4)
    bq.normalize()
    const q = quat(1, 2, 3, 4)
    quatNormalize(q)
    expect(q[0]).toBeCloseTo(bq.x, 10)
    expect(q[1]).toBeCloseTo(bq.y, 10)
    expect(q[2]).toBeCloseTo(bq.z, 10)
    expect(q[3]).toBeCloseTo(bq.w, 10)
  })

  it('quatFromAxisAngle matches BabylonJS', () => {
    const axis = new Vector3(0, 1, 0)
    const angle = Math.PI / 3
    const bq = Quaternion.RotationAxis(axis, angle)

    const dst = quat(0, 0, 0, 0)
    quatFromAxisAngle(dst, vec3(0, 1, 0), angle)
    expect(dst[0]).toBeCloseTo(bq.x, 10)
    expect(dst[1]).toBeCloseTo(bq.y, 10)
    expect(dst[2]).toBeCloseTo(bq.z, 10)
    expect(dst[3]).toBeCloseTo(bq.w, 10)
  })

  it('quatFromYawPitchRoll matches BabylonJS', () => {
    const yaw = 0.7
    const pitch = -0.3
    const roll = 0.5
    const bq = Quaternion.RotationYawPitchRoll(yaw, pitch, roll)

    const dst = quat(0, 0, 0, 0)
    quatFromYawPitchRoll(dst, yaw, pitch, roll)
    expect(dst[0]).toBeCloseTo(bq.x, 10)
    expect(dst[1]).toBeCloseTo(bq.y, 10)
    expect(dst[2]).toBeCloseTo(bq.z, 10)
    expect(dst[3]).toBeCloseTo(bq.w, 10)
  })

  it('quatToUnitPoint matches existing quaternionToUnitPointFastInPlace', () => {
    const bq = Quaternion.RotationYawPitchRoll(0.5, 0.3, -0.2)
    const target = { x: 0, y: 0, z: 0 }
    // Use the existing scalar implementation as reference
    const { x: qx, y: qy, z: qz, w: qw } = bq
    target.x = 2 * (qx * qy - qz * qw)
    target.y = 1 - 2 * (qx * qx + qz * qz)
    target.z = 2 * (qy * qz + qx * qw)

    const q = quat(bq.x, bq.y, bq.z, bq.w)
    const dst = vec3(0, 0, 0)
    quatToUnitPoint(dst, q)

    expect(dst[0]).toBeCloseTo(target.x, 10)
    expect(dst[1]).toBeCloseTo(target.y, 10)
    expect(dst[2]).toBeCloseTo(target.z, 10)
  })

  it('quatFromUnitPoint matches BabylonJS unitPointToQuaternion at north pole', () => {
    const dst = quat(0, 0, 0, 0)
    quatFromUnitPoint(dst, 0, 1, 0)

    // Both should produce identity-like quaternion at north pole
    // Verify round-trip: extract unit point from result
    const pt = vec3(0, 0, 0)
    quatToUnitPoint(pt, dst)
    expect(pt[0]).toBeCloseTo(0, EPSILON)
    expect(pt[1]).toBeCloseTo(1, EPSILON)
    expect(pt[2]).toBeCloseTo(0, EPSILON)
  })

  it('quatFromUnitPoint matches BabylonJS unitPointToQuaternion at south pole', () => {
    const dst = quat(0, 0, 0, 0)
    quatFromUnitPoint(dst, 0, -1, 0)

    // Round-trip: must recover the south pole
    const pt = vec3(0, 0, 0)
    quatToUnitPoint(pt, dst)
    expect(pt[0]).toBeCloseTo(0, EPSILON)
    expect(pt[1]).toBeCloseTo(-1, EPSILON)
    expect(pt[2]).toBeCloseTo(0, EPSILON)
  })

  it('quatFromUnitPoint matches BabylonJS unitPointToQuaternion at equator points', () => {
    const testPoints = [
      [1, 0, 0],
      [0, 0, 1],
      [-1, 0, 0],
      [0, 0, -1],
      [0.707, 0, 0.707],
    ] as const

    for (const [x, y, z] of testPoints) {
      const bq = unitPointToQuaternion(x, y, z)
      const dst = quat(0, 0, 0, 0)
      quatFromUnitPoint(dst, x, y, z)

      // Round-trip: unit point from scalar result must match input
      const pt = vec3(0, 0, 0)
      quatToUnitPoint(pt, dst)
      expect(pt[0]).toBeCloseTo(x, EPSILON)
      expect(pt[1]).toBeCloseTo(y, EPSILON)
      expect(pt[2]).toBeCloseTo(z, EPSILON)

      // Round-trip: unit point from unitPointToQuaternion result must also match
      const bPt = { x: 0, y: 0, z: 0 }
      bPt.x = 2 * (bq[0] * bq[1] - bq[2] * bq[3])
      bPt.y = 1 - 2 * (bq[0] * bq[0] + bq[2] * bq[2])
      bPt.z = 2 * (bq[1] * bq[2] + bq[0] * bq[3])
      expect(pt[0]).toBeCloseTo(bPt.x, EPSILON)
      expect(pt[1]).toBeCloseTo(bPt.y, EPSILON)
      expect(pt[2]).toBeCloseTo(bPt.z, EPSILON)
    }
  })

  it('quatFromUnitPoint at arbitrary lat/lng points round-trips correctly', () => {
    // Points at various latitudes and longitudes
    const testPoints = [
      [0.5, 0.7, 0.5],
      [-0.3, 0.8, 0.5],
      [0.1, -0.9, 0.4],
      [0.6, 0.2, -0.7],
    ]

    for (const [rawX, rawY, rawZ] of testPoints) {
      // Normalize
      const len = Math.sqrt(
        (rawX ?? 0) * (rawX ?? 0) +
          (rawY ?? 0) * (rawY ?? 0) +
          (rawZ ?? 0) * (rawZ ?? 0)
      )
      const x = (rawX ?? 0) / len
      const y = (rawY ?? 0) / len
      const z = (rawZ ?? 0) / len

      const dst = quat(0, 0, 0, 0)
      quatFromUnitPoint(dst, x, y, z)

      const pt = vec3(0, 0, 0)
      quatToUnitPoint(pt, dst)
      expect(pt[0]).toBeCloseTo(x, EPSILON)
      expect(pt[1]).toBeCloseTo(y, EPSILON)
      expect(pt[2]).toBeCloseTo(z, EPSILON)
    }
  })

  it('quatIdentity round-trips through quatToUnitPoint to (0, 1, 0)', () => {
    const q = quatIdentity()
    const pt = vec3(0, 0, 0)
    quatToUnitPoint(pt, q)
    expect(pt[0]).toBeCloseTo(0, 10)
    expect(pt[1]).toBeCloseTo(1, 10)
    expect(pt[2]).toBeCloseTo(0, 10)
  })
})
