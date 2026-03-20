import { describe, expect, it } from 'vitest'
import { vec3 } from '../../../src/features/engine/math/create.js'
import { moveBullet } from '../../../src/index.js'
import { makeBullet } from '../../helpers/entities.js'

describe('moveBullet', () => {
  it('does not move a bullet at rest', () => {
    const bullet = makeBullet()
    const x0 = bullet.position[0]
    const y0 = bullet.position[1]
    const z0 = bullet.position[2]
    moveBullet(bullet, 16)
    expect(bullet.position[0]).toBe(x0)
    expect(bullet.position[1]).toBe(y0)
    expect(bullet.position[2]).toBe(z0)
  })

  it('updates position when bullet has angular velocity', () => {
    const bullet = makeBullet({ angularVelocity: vec3(0.5, 0, 0) })
    const x0 = bullet.position[0]
    const y0 = bullet.position[1]
    const z0 = bullet.position[2]
    moveBullet(bullet, 100)
    const moved =
      Math.abs(bullet.position[0] - x0) > 0.001 ||
      Math.abs(bullet.position[1] - y0) > 0.001 ||
      Math.abs(bullet.position[2] - z0) > 0.001
    expect(moved).toBe(true)
  })
})
