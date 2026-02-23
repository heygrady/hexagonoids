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
    const latBefore = bullet.lat
    const lngBefore = bullet.lng
    moveBullet(bullet, 16, RADIUS)
    expect(bullet.lat).toBe(latBefore)
    expect(bullet.lng).toBe(lngBefore)
  })

  it('updates lat/lng when bullet has angular velocity', () => {
    const bullet = makeBullet({ angularVelocity: new Vector3(0.5, 0, 0) })
    const latBefore = bullet.lat
    const lngBefore = bullet.lng
    moveBullet(bullet, 100, RADIUS)
    const moved =
      Math.abs(bullet.lat - latBefore) > 0.001 ||
      Math.abs(bullet.lng - lngBefore) > 0.001
    expect(moved).toBe(true)
  })
})
