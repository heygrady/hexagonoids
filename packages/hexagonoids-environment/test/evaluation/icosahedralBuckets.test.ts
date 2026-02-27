import { describe, expect, it } from 'vitest'
import {
  BUCKET_SYSTEM,
  findBucketXYZ,
} from '../../src/evaluation/icosahedralBuckets.js'

describe('BUCKET_SYSTEM', () => {
  it('has between 60 and 200 buckets', () => {
    expect(BUCKET_SYSTEM.count).toBeGreaterThanOrEqual(60)
    expect(BUCKET_SYSTEM.count).toBeLessThanOrEqual(200)
  })

  it('all reference points have unit length', () => {
    for (let i = 0; i < BUCKET_SYSTEM.count; i++) {
      const off = i * 3
      const x = BUCKET_SYSTEM.points[off]!
      const y = BUCKET_SYSTEM.points[off + 1]!
      const z = BUCKET_SYSTEM.points[off + 2]!
      const len = Math.sqrt(x * x + y * y + z * z)
      expect(len).toBeCloseTo(1.0, 6)
    }
  })
})

describe('findBucketXYZ', () => {
  it('returns different indices for north pole vs south pole', () => {
    const north = findBucketXYZ(0, 0, 1)
    const south = findBucketXYZ(0, 0, -1)
    expect(north).not.toBe(south)
  })

  it('returns same index for nearby points', () => {
    const a = findBucketXYZ(0, 0, 1)
    // Slightly offset from north pole
    const b = findBucketXYZ(0.01, 0.01, 0.9999)
    expect(a).toBe(b)
  })

  it('returns indices within valid range', () => {
    const idx = findBucketXYZ(1, 0, 0)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(idx).toBeLessThan(BUCKET_SYSTEM.count)
  })

  it('covers multiple buckets for distributed points', () => {
    const buckets = new Set<number>()
    // Test 6 cardinal directions
    buckets.add(findBucketXYZ(1, 0, 0))
    buckets.add(findBucketXYZ(-1, 0, 0))
    buckets.add(findBucketXYZ(0, 1, 0))
    buckets.add(findBucketXYZ(0, -1, 0))
    buckets.add(findBucketXYZ(0, 0, 1))
    buckets.add(findBucketXYZ(0, 0, -1))
    expect(buckets.size).toBe(6)
  })
})
