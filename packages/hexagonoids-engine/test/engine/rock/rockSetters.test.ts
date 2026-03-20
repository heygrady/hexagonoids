import { describe, expect, it } from 'vitest'
import {
  ROCK_LARGE_SIZE,
  ROCK_LARGE_VALUE,
  ROCK_MEDIUM_SIZE,
  ROCK_MEDIUM_VALUE,
  ROCK_SMALL_SIZE,
  ROCK_SMALL_VALUE,
  setRockSize,
} from '../../../src/index.js'
import { makeRock } from '../../helpers/entities.js'

describe('rockSetters', () => {
  describe('setRockSize', () => {
    it('updates size and recalculates value for all sizes', () => {
      const rock = makeRock({
        size: ROCK_LARGE_SIZE,
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
      const rock = makeRock({
        size: ROCK_LARGE_SIZE,
      })
      const changed = setRockSize(rock, ROCK_LARGE_SIZE)

      expect(changed).toBe(false)
      expect(rock.value).toBe(ROCK_LARGE_VALUE)
    })
  })
})
