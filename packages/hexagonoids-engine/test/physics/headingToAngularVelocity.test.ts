import { describe, expect, it } from 'vitest'
import { quat, vec3Zero } from '../../src/features/engine/math/create.js'
import { quatFromYawPitchRoll } from '../../src/features/engine/math/quat.js'
import type { Quat } from '../../src/features/engine/math/types.js'

import { headingToAngularVelocity } from '../../src/features/engine/physics/quaternionPhysics.js'

const testCases: Array<{
  name: string
  q: Quat
  heading: number
  speed: number
}> = []

// identity
const identityQ = quat(0, 0, 0, 1)
testCases.push({ name: 'identity', q: identityQ, heading: 0, speed: 1 })

// rotated 90 around Y
const q90Y = new Float64Array(4) as Quat
quatFromYawPitchRoll(q90Y, Math.PI / 2, 0, 0)
testCases.push({
  name: 'rotated 90 around Y',
  q: q90Y,
  heading: 0,
  speed: 2,
})

// tilted with heading
const qTilted = new Float64Array(4) as Quat
quatFromYawPitchRoll(qTilted, 0.3, 0.5, 0.1)
testCases.push({
  name: 'tilted with heading',
  q: qTilted,
  heading: Math.PI / 4,
  speed: 1.5,
})

// arbitrary orientation + heading
const qArb = new Float64Array(4) as Quat
quatFromYawPitchRoll(qArb, 1.2, -0.7, 0.4)
testCases.push({
  name: 'arbitrary orientation + heading',
  q: qArb,
  heading: -Math.PI / 3,
  speed: 0.8,
})

// near-pole orientation
const qPole = new Float64Array(4) as Quat
quatFromYawPitchRoll(qPole, 0, Math.PI / 2 - 0.01, 0)
testCases.push({
  name: 'near-pole orientation',
  q: qPole,
  heading: Math.PI,
  speed: 3,
})

describe('headingToAngularVelocity scalar', () => {
  for (const tc of testCases) {
    it(`produces correct magnitude: ${tc.name}`, () => {
      const dst = vec3Zero()
      headingToAngularVelocity(dst, tc.q, tc.heading, tc.speed)

      const len = Math.sqrt(dst[0] ** 2 + dst[1] ** 2 + dst[2] ** 2)
      expect(len).toBeCloseTo(tc.speed, 4)
    })
  }

  it('returns zero for zero speed', () => {
    const q = new Float64Array(4) as Quat
    quatFromYawPitchRoll(q, 0.5, 0.3, 0.1)
    const dst = vec3Zero()
    headingToAngularVelocity(dst, q, Math.PI / 4, 0)
    expect(dst[0]).toBe(0)
    expect(dst[1]).toBe(0)
    expect(dst[2]).toBe(0)
  })
})
