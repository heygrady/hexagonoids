import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { describe, expect, it } from 'vitest'
import type { RockState } from '../../../src/index.js'
import { moveRock, RADIUS, ROCK_LARGE_SIZE } from '../../../src/index.js'

/** Create a fresh rock state for testing. */
const makeRock = (overrides: Partial<RockState> = {}): RockState => ({
  id: 'test-rock',
  orientation: Quaternion.Identity(),
  lat: 0,
  lng: 0,
  angularVelocity: Vector3.Zero(),
  size: ROCK_LARGE_SIZE,
  value: 20,
  ...overrides,
})

describe('moveRock', () => {
  it('does not move a rock at rest', () => {
    const rock = makeRock()
    const latBefore = rock.lat
    const lngBefore = rock.lng
    moveRock(rock, 16, RADIUS)
    expect(rock.lat).toBe(latBefore)
    expect(rock.lng).toBe(lngBefore)
  })

  it('updates lat/lng when rock has angular velocity', () => {
    const rock = makeRock({ angularVelocity: new Vector3(0.5, 0, 0) })
    const latBefore = rock.lat
    const lngBefore = rock.lng
    moveRock(rock, 100, RADIUS)
    const moved =
      Math.abs(rock.lat - latBefore) > 0.001 ||
      Math.abs(rock.lng - lngBefore) > 0.001
    expect(moved).toBe(true)
  })
})
