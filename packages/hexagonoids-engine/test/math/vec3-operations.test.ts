import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { describe, expect, it } from 'vitest'

import { quat, vec3 } from '../../src/features/engine/math/create.js'
import {
  vec3AddInPlace,
  vec3ApplyQuat,
  vec3Copy,
  vec3Cross,
  vec3Dot,
  vec3Equals,
  vec3Length,
  vec3LengthSq,
  vec3Normalize,
  vec3Scale,
  vec3ScaleInPlace,
  vec3Set,
} from '../../src/features/engine/math/vec3.js'

const EPSILON = 1e-10

describe('vec3 operations', () => {
  it('vec3Copy', () => {
    const src = vec3(1, 2, 3)
    const dst = vec3(0, 0, 0)
    vec3Copy(dst, src)
    expect(dst[0]).toBe(1)
    expect(dst[1]).toBe(2)
    expect(dst[2]).toBe(3)
  })

  it('vec3Set', () => {
    const v = vec3(0, 0, 0)
    vec3Set(v, 4, 5, 6)
    expect(v[0]).toBe(4)
    expect(v[1]).toBe(5)
    expect(v[2]).toBe(6)
  })

  it('vec3Scale matches BabylonJS', () => {
    const bv = new Vector3(3, -1, 2)
    const bResult = bv.scale(2.5)
    const dst = vec3(0, 0, 0)
    vec3Scale(dst, vec3(3, -1, 2), 2.5)
    expect(dst[0]).toBeCloseTo(bResult.x, 10)
    expect(dst[1]).toBeCloseTo(bResult.y, 10)
    expect(dst[2]).toBeCloseTo(bResult.z, 10)
  })

  it('vec3ScaleInPlace', () => {
    const v = vec3(2, 4, 6)
    vec3ScaleInPlace(v, 0.5)
    expect(v[0]).toBe(1)
    expect(v[1]).toBe(2)
    expect(v[2]).toBe(3)
  })

  it('vec3AddInPlace matches BabylonJS', () => {
    const ba = new Vector3(1, 2, 3)
    ba.addInPlace(new Vector3(4, 5, 6))
    const a = vec3(1, 2, 3)
    vec3AddInPlace(a, vec3(4, 5, 6))
    expect(a[0]).toBeCloseTo(ba.x, 10)
    expect(a[1]).toBeCloseTo(ba.y, 10)
    expect(a[2]).toBeCloseTo(ba.z, 10)
  })

  it('vec3Length matches BabylonJS', () => {
    const bv = new Vector3(3, 4, 0)
    const scalar = vec3Length(vec3(3, 4, 0))
    expect(scalar).toBeCloseTo(bv.length(), 10)
  })

  it('vec3LengthSq matches BabylonJS', () => {
    const bv = new Vector3(1, 2, 3)
    const scalar = vec3LengthSq(vec3(1, 2, 3))
    expect(scalar).toBeCloseTo(bv.lengthSquared(), 10)
  })

  it('vec3Normalize matches BabylonJS', () => {
    const bv = new Vector3(3, 0, 4)
    const bNorm = bv.normalizeToNew()
    const v = vec3(3, 0, 4)
    vec3Normalize(v)
    expect(v[0]).toBeCloseTo(bNorm.x, 10)
    expect(v[1]).toBeCloseTo(bNorm.y, 10)
    expect(v[2]).toBeCloseTo(bNorm.z, 10)
  })

  it('vec3Normalize handles zero vector', () => {
    const v = vec3(0, 0, 0)
    vec3Normalize(v)
    expect(v[0]).toBe(0)
    expect(v[1]).toBe(0)
    expect(v[2]).toBe(0)
  })

  it('vec3Dot matches BabylonJS', () => {
    const ba = new Vector3(1, 2, 3)
    const bb = new Vector3(4, -5, 6)
    const bDot = Vector3.Dot(ba, bb)
    const sDot = vec3Dot(vec3(1, 2, 3), vec3(4, -5, 6))
    expect(sDot).toBeCloseTo(bDot, 10)
  })

  it('vec3Cross matches BabylonJS', () => {
    const ba = new Vector3(1, 0, 0)
    const bb = new Vector3(0, 1, 0)
    const bCross = Vector3.Cross(ba, bb)
    const dst = vec3(0, 0, 0)
    vec3Cross(dst, vec3(1, 0, 0), vec3(0, 1, 0))
    expect(dst[0]).toBeCloseTo(bCross.x, 10)
    expect(dst[1]).toBeCloseTo(bCross.y, 10)
    expect(dst[2]).toBeCloseTo(bCross.z, 10)
  })

  it('vec3Cross with non-axis vectors matches BabylonJS', () => {
    const ba = new Vector3(2, 3, 4)
    const bb = new Vector3(5, 6, 7)
    const bCross = Vector3.Cross(ba, bb)
    const dst = vec3(0, 0, 0)
    vec3Cross(dst, vec3(2, 3, 4), vec3(5, 6, 7))
    expect(dst[0]).toBeCloseTo(bCross.x, 10)
    expect(dst[1]).toBeCloseTo(bCross.y, 10)
    expect(dst[2]).toBeCloseTo(bCross.z, 10)
  })

  it('vec3Equals', () => {
    expect(vec3Equals(vec3(1, 2, 3), vec3(1, 2, 3))).toBe(true)
    expect(vec3Equals(vec3(1, 2, 3), vec3(1, 2, 4))).toBe(false)
  })

  it('vec3ApplyQuat matches BabylonJS', () => {
    const bq = Quaternion.RotationAxis(new Vector3(0, 1, 0), Math.PI / 2)
    const bv = new Vector3(1, 0, 0)
    const bResult = bv.applyRotationQuaternion(bq)

    const q = quat(bq.x, bq.y, bq.z, bq.w)
    const v = vec3(1, 0, 0)
    const dst = vec3(0, 0, 0)
    vec3ApplyQuat(dst, v, q)

    expect(dst[0]).toBeCloseTo(bResult.x, 10)
    expect(dst[1]).toBeCloseTo(bResult.y, 10)
    expect(dst[2]).toBeCloseTo(bResult.z, 10)
  })

  it('vec3ApplyQuat with arbitrary quaternion matches BabylonJS', () => {
    const bq = Quaternion.RotationYawPitchRoll(0.7, 0.3, -0.5)
    const bv = new Vector3(0.5, -0.3, 0.8)
    const bResult = bv.applyRotationQuaternion(bq)

    const q = quat(bq.x, bq.y, bq.z, bq.w)
    const dst = vec3(0, 0, 0)
    vec3ApplyQuat(dst, vec3(0.5, -0.3, 0.8), q)

    expect(dst[0]).toBeCloseTo(bResult.x, EPSILON)
    expect(dst[1]).toBeCloseTo(bResult.y, EPSILON)
    expect(dst[2]).toBeCloseTo(bResult.z, EPSILON)
  })
})
