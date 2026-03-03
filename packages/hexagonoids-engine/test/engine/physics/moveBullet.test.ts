import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { describe, expect, it } from 'vitest'
import type { BulletState } from '../../../src/index.js'
import { moveBullet, RADIUS } from '../../../src/index.js'

/** Create a fresh bullet state for testing. */
const makeBullet = (overrides: Partial<BulletState> = {}): BulletState => ({
  id: 'test-bullet',
  orientation: Quaternion.Identity(),
  lat: 0,
  lng: 0,
  angularVelocity: Vector3.Zero(),
  firedAt: null,
  ownerId: 'test-ship',
  ...overrides,
})

describe('moveBullet', () => {
  it('does not move a bullet at rest', () => {
    const bullet = makeBullet()
    const xBefore = bullet.x
    const yBefore = bullet.y
    const zBefore = bullet.z
    moveBullet(bullet, 16, RADIUS)
    expect(bullet.x).toBe(xBefore)
    expect(bullet.y).toBe(yBefore)
    expect(bullet.z).toBe(zBefore)
  })

  it('updates xyz when bullet has angular velocity', () => {
    const bullet = makeBullet({ angularVelocity: new Vector3(0.5, 0, 0) })
    const xBefore = bullet.x ?? 0
    const yBefore = bullet.y ?? 1
    const zBefore = bullet.z ?? 0
    moveBullet(bullet, 100, RADIUS)
    const moved =
      Math.abs((bullet.x ?? 0) - xBefore) > 0.001 ||
      Math.abs((bullet.y ?? 1) - yBefore) > 0.001 ||
      Math.abs((bullet.z ?? 0) - zBefore) > 0.001
    expect(moved).toBe(true)
  })
})
