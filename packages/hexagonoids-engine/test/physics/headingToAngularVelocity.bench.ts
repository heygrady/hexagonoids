import { bench, describe, expect, it } from 'vitest'
import { vec3Zero } from '../../src/features/engine/math/create.js'
import { quatFromYawPitchRoll } from '../../src/features/engine/math/quat.js'
import type { Quat } from '../../src/features/engine/math/types.js'

import { headingToAngularVelocity } from '../../src/features/engine/physics/quaternionPhysics.js'

// Test quaternion representing an arbitrary orientation
const q = new Float64Array(4) as Quat
quatFromYawPitchRoll(q, 1.2, -0.7, 0.4)

describe('headingToAngularVelocity correctness', () => {
  it('produces correct magnitude for arbitrary orientation', () => {
    const dst = vec3Zero()
    headingToAngularVelocity(dst, q, -Math.PI / 3, 0.8)
    const len = Math.sqrt(dst[0] ** 2 + dst[1] ** 2 + dst[2] ** 2)
    expect(len).toBeCloseTo(0.8, 4)
  })

  it('returns zero for zero speed', () => {
    const qTest = new Float64Array(4) as Quat
    quatFromYawPitchRoll(qTest, 0.5, 0.3, 0.1)
    const dst = vec3Zero()
    headingToAngularVelocity(dst, qTest, Math.PI / 4, 0)
    expect(dst[0]).toBe(0)
    expect(dst[1]).toBe(0)
    expect(dst[2]).toBe(0)
  })
})

describe('headingToAngularVelocity benchmark', () => {
  const dst = vec3Zero()

  bench('scalar (current)', () => {
    headingToAngularVelocity(dst, q, -Math.PI / 3, 0.8)
  })
})
