import { describe, expect, it } from 'vitest'
import { vec3, vec3Zero } from '../../../src/features/engine/math/create.js'
import { setBulletAngularVelocity } from '../../../src/index.js'
import { makeBullet } from '../../helpers/entities.js'

describe('bulletSetters', () => {
  describe('setBulletAngularVelocity', () => {
    it('returns false when velocity is unchanged', () => {
      const bullet = makeBullet()
      const changed = setBulletAngularVelocity(bullet, vec3Zero())

      expect(changed).toBe(false)
    })

    it('returns true and copies velocity when changed', () => {
      const bullet = makeBullet()
      const newVelocity = vec3(1, 0, 0)

      const changed = setBulletAngularVelocity(bullet, newVelocity)

      expect(changed).toBe(true)
      expect(bullet.angularVelocity[0]).toBe(1)
      // Verify it was copied (not the same reference)
      expect(bullet.angularVelocity).not.toBe(newVelocity)
    })
  })
})
