import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { describe, expect, it } from 'vitest'
import type { RockState } from '../../../src/index.js'
import {
  defaultRockState,
  ROCK_LARGE_SIZE,
  ROCK_LARGE_VALUE,
  ROCK_MEDIUM_SIZE,
  ROCK_MEDIUM_VALUE,
  ROCK_SMALL_SIZE,
  ROCK_SMALL_VALUE,
  setRockSize,
} from '../../../src/index.js'

function createRock(overrides: Partial<RockState> = {}): RockState {
  return {
    ...defaultRockState,
    id: 'r1',
    orientation: Quaternion.Identity(),
    angularVelocity: Vector3.Zero(),
    ...overrides,
  }
}

describe('rockSetters', () => {
  describe('setRockSize', () => {
    it('updates size and recalculates value for all sizes', () => {
      const rock = createRock({
        size: ROCK_LARGE_SIZE,
        value: ROCK_LARGE_VALUE,
      })

      setRockSize(rock, ROCK_MEDIUM_SIZE)
      expect(rock.size).toBe(ROCK_MEDIUM_SIZE)
      expect(rock.value).toBe(ROCK_MEDIUM_VALUE)

      setRockSize(rock, ROCK_SMALL_SIZE)
      expect(rock.size).toBe(ROCK_SMALL_SIZE)
      expect(rock.value).toBe(ROCK_SMALL_VALUE)

      setRockSize(rock, ROCK_LARGE_SIZE)
      expect(rock.size).toBe(ROCK_LARGE_SIZE)
      expect(rock.value).toBe(ROCK_LARGE_VALUE)
    })

    it('returns false when size is unchanged', () => {
      const rock = createRock({
        size: ROCK_LARGE_SIZE,
        value: ROCK_LARGE_VALUE,
      })
      const changed = setRockSize(rock, ROCK_LARGE_SIZE)

      expect(changed).toBe(false)
      expect(rock.value).toBe(ROCK_LARGE_VALUE)
    })
  })
})
