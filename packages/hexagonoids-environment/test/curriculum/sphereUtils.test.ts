import { describe, expect, it } from 'vitest'

import {
  destinationOnSphere,
  headingToward,
} from '../../src/curriculum/sphereUtils.js'

describe('destinationOnSphere', () => {
  it('returns a point at the correct angular distance', () => {
    // Start at equator (1, 0, 0)
    const ox = 1,
      oy = 0,
      oz = 0
    const yaw = 0 // east (engine convention)
    const distance = 0.3 // radians

    const [dx, dy, dz] = destinationOnSphere(ox, oy, oz, yaw, distance)

    // Check the point is on the unit sphere
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
    expect(len).toBeCloseTo(1.0, 6)

    // Check angular distance via dot product: cos(d) = dot(origin, dest)
    const dot = ox * dx + oy * dy + oz * dz
    const actualDistance = Math.acos(Math.max(-1, Math.min(1, dot)))
    expect(actualDistance).toBeCloseTo(distance, 5)
  })

  it('result lies on unit sphere for various yaw values', () => {
    const ox = 0.5,
      oy = 0.7,
      oz = 0.5099
    const len = Math.sqrt(ox * ox + oy * oy + oz * oz)
    const nx = ox / len,
      ny = oy / len,
      nz = oz / len

    for (const yaw of [0, Math.PI / 4, Math.PI / 2, Math.PI, -1.5]) {
      const [dx, dy, dz] = destinationOnSphere(nx, ny, nz, yaw, 0.3)
      const dLen = Math.sqrt(dx * dx + dy * dy + dz * dz)
      expect(dLen).toBeCloseTo(1.0, 6)

      // Angular distance should be correct
      const dot = nx * dx + ny * dy + nz * dz
      expect(Math.acos(Math.max(-1, Math.min(1, dot)))).toBeCloseTo(0.3, 5)
    }
  })

  it('zero distance returns origin', () => {
    const ox = 0,
      oy = 1,
      oz = 0 // north pole
    const [dx, dy, dz] = destinationOnSphere(ox, oy, oz, 0, 0)
    expect(dx).toBeCloseTo(ox, 10)
    expect(dy).toBeCloseTo(oy, 10)
    expect(dz).toBeCloseTo(oz, 10)
  })

  it('yaw=0 moves east from equator origin', () => {
    // From (1, 0, 0) with yaw=0 (east), should move along the equator.
    // Engine east at (1,0,0) is (0,0,+1), matching cross(origin, pole).
    const [, dy, dz] = destinationOnSphere(1, 0, 0, 0, 0.3)
    expect(dz).toBeGreaterThan(0) // moved east (positive z)
    expect(dy).toBeCloseTo(0, 5) // stayed on equator
  })
})

describe('headingToward', () => {
  it('produces bearing that points from A to B', () => {
    // A at equator, B slightly north
    const ax = 1,
      ay = 0,
      az = 0
    const bx = Math.cos(0.1),
      by = Math.sin(0.1),
      bz = 0

    const heading = headingToward(ax, ay, az, bx, by, bz)

    // Use heading to go from A toward B, should get closer
    const [cx, cy, cz] = destinationOnSphere(ax, ay, az, heading, 0.1)

    // c should be close to b
    const dotCB = cx * bx + cy * by + cz * bz
    expect(dotCB).toBeGreaterThan(0.99)
  })

  it('returns 0 for coincident points', () => {
    const heading = headingToward(1, 0, 0, 1, 0, 0)
    expect(heading).toBe(0)
  })

  it('heading from equator east to equator further east is correct', () => {
    // A at (1, 0, 0), B at (cos(0.1), 0, sin(0.1))
    const ax = 1,
      ay = 0,
      az = 0
    const bx = Math.cos(0.1),
      by = 0,
      bz = Math.sin(0.1)

    const heading = headingToward(ax, ay, az, bx, by, bz)

    // Heading should be ~0 (east in engine yaw convention)
    expect(heading).toBeCloseTo(0, 1)
  })
})
