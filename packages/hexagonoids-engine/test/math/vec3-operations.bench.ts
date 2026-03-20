import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { bench, describe } from 'vitest'

import { quat, vec3 } from '../../src/features/engine/math/create.js'
import {
  vec3ApplyQuat,
  vec3Cross,
  vec3Dot,
  vec3Length,
  vec3Scale,
} from '../../src/features/engine/math/vec3.js'

// Each bench call = one operation. Vitest handles iteration count.
// Use a sink to prevent dead-code elimination.
let sink = 0

describe('vec3 benchmarks', () => {
  const bv = new Vector3(3, -1, 2)
  const bv2 = new Vector3(5, 6, 7)
  const sv = vec3(3, -1, 2)
  const sv2 = vec3(5, 6, 7)
  const dst = vec3(0, 0, 0)
  const bq = Quaternion.RotationYawPitchRoll(0.7, 0.3, -0.5)
  const sq = quat(bq.x, bq.y, bq.z, bq.w)

  bench('BabylonJS Vector3.scale', () => {
    const r = bv.scale(2.5)
    sink += r.x
  })

  bench('scalar vec3Scale', () => {
    vec3Scale(dst, sv, 2.5)
    sink += dst[0]
  })

  bench('BabylonJS Vector3.length', () => {
    sink += bv.length()
  })

  bench('scalar vec3Length', () => {
    sink += vec3Length(sv)
  })

  bench('BabylonJS Vector3.Dot', () => {
    sink += Vector3.Dot(bv, bv2)
  })

  bench('scalar vec3Dot', () => {
    sink += vec3Dot(sv, sv2)
  })

  bench('BabylonJS Vector3.Cross (allocating)', () => {
    const r = Vector3.Cross(bv, bv2)
    sink += r.x
  })

  bench('scalar vec3Cross (in-place)', () => {
    vec3Cross(dst, sv, sv2)
    sink += dst[0]
  })

  bench('BabylonJS applyRotationQuaternion (allocating)', () => {
    const r = bv.applyRotationQuaternion(bq)
    sink += r.x
  })

  bench('scalar vec3ApplyQuat (in-place)', () => {
    vec3ApplyQuat(dst, sv, sq)
    sink += dst[0]
  })
})
