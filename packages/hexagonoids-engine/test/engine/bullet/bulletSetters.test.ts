import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { describe, expect, it } from 'vitest'
import type { BulletState } from '../../../src/index.js'
import {
  defaultBulletState,
  setBulletAngularVelocity,
} from '../../../src/index.js'

function createBullet(overrides: Partial<BulletState> = {}): BulletState {
  return {
    ...defaultBulletState,
    id: 'b1',
    ownerId: 's1',
    orientation: Quaternion.Identity(),
    angularVelocity: Vector3.Zero(),
    ...overrides,
  }
}

describe('bulletSetters', () => {
  describe('setBulletAngularVelocity', () => {
    it('returns false when velocity is unchanged', () => {
      const bullet = createBullet()
      const changed = setBulletAngularVelocity(bullet, Vector3.Zero())

      expect(changed).toBe(false)
    })

    it('returns true and clones velocity when changed', () => {
      const bullet = createBullet()
      const newVelocity = new Vector3(1, 0, 0)

      const changed = setBulletAngularVelocity(bullet, newVelocity)

      expect(changed).toBe(true)
      expect(bullet.angularVelocity.x).toBe(1)
      // Verify it was cloned (not the same reference)
      expect(bullet.angularVelocity).not.toBe(newVelocity)
    })
  })
})
