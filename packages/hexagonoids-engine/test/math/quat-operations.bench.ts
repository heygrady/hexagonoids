import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { bench, describe } from 'vitest'

import { quat, vec3 } from '../../src/features/engine/math/create.js'
import {
  quatFromAxisAngle,
  quatFromUnitPoint,
  quatFromYawPitchRoll,
  quatMultiply,
  quatToUnitPoint,
} from '../../src/features/engine/math/quat.js'
import { unitPointToQuaternion } from '../../src/features/engine/physics/latLng.js'

let sink = 0

describe('quat benchmarks', () => {
  const ba = Quaternion.RotationAxis(new Vector3(0, 1, 0), 0.5)
  const bb = Quaternion.RotationAxis(new Vector3(1, 0, 0), 0.3)
  const sa = quat(ba.x, ba.y, ba.z, ba.w)
  const sb = quat(bb.x, bb.y, bb.z, bb.w)
  const dst = quat(0, 0, 0, 0)
  const axis = vec3(0, 1, 0)
  const ptDst = vec3(0, 0, 0)

  bench('BabylonJS Quaternion.multiply (allocating)', () => {
    const r = ba.multiply(bb)
    sink += r.x
  })

  bench('scalar quatMultiply (in-place)', () => {
    quatMultiply(dst, sa, sb)
    sink += dst[0]
  })

  bench('BabylonJS RotationAxis (allocating)', () => {
    const r = Quaternion.RotationAxis(new Vector3(0, 1, 0), 0.5)
    sink += r.x
  })

  bench('scalar quatFromAxisAngle (in-place)', () => {
    quatFromAxisAngle(dst, axis, 0.5)
    sink += dst[0]
  })

  bench('BabylonJS RotationYawPitchRoll (allocating)', () => {
    const r = Quaternion.RotationYawPitchRoll(0.7, -0.3, 0.5)
    sink += r.x
  })

  bench('scalar quatFromYawPitchRoll (in-place)', () => {
    quatFromYawPitchRoll(dst, 0.7, -0.3, 0.5)
    sink += dst[0]
  })

  bench('BabylonJS unitPointToQuaternion (allocating)', () => {
    const r = unitPointToQuaternion(0.5, 0.7, 0.5)
    sink += r[0]
  })

  bench('scalar quatFromUnitPoint (in-place)', () => {
    quatFromUnitPoint(dst, 0.5, 0.7, 0.5)
    sink += dst[0]
  })

  bench('quatToUnitPoint', () => {
    quatToUnitPoint(ptDst, sa)
    sink += ptDst[0]
  })
})
