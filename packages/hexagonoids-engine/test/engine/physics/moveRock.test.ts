import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { describe, expect, it } from 'vitest'
import type { RockState } from '../../../src/index.js'
import { moveRock, RADIUS, ROCK_LARGE_SIZE } from '../../../src/index.js'
import { pointFromLatLng } from '../../helpers/points.js'

/** Create a fresh rock state for testing. */
const makeRock = (overrides: Partial<RockState> = {}): RockState => ({
  id: 'test-rock',
  orientation: Quaternion.Identity(),
  ...pointFromLatLng(0, 0),
  angularVelocity: Vector3.Zero(),
  size: ROCK_LARGE_SIZE,
  value: 20,
  ...overrides,
})

describe('moveRock', () => {
  it('does not move a rock at rest', () => {
    const rock = makeRock()
    const xBefore = rock.x
    const yBefore = rock.y
    const zBefore = rock.z
    moveRock(rock, 16, RADIUS)
    expect(rock.x).toBe(xBefore)
    expect(rock.y).toBe(yBefore)
    expect(rock.z).toBe(zBefore)
  })

  it('updates xyz when rock has angular velocity', () => {
    const rock = makeRock({ angularVelocity: new Vector3(0.5, 0, 0) })
    const xBefore = rock.x ?? 0
    const yBefore = rock.y ?? 1
    const zBefore = rock.z ?? 0
    moveRock(rock, 100, RADIUS)
    const moved =
      Math.abs((rock.x ?? 0) - xBefore) > 0.001 ||
      Math.abs((rock.y ?? 1) - yBefore) > 0.001 ||
      Math.abs((rock.z ?? 0) - zBefore) > 0.001
    expect(moved).toBe(true)
  })
})
