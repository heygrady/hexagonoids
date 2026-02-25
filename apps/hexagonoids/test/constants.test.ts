import { describe, expect, test } from 'vitest'

import {
  ROCK_TOTAL_VALUE,
  ROCK_WAVE_MIN_SCORES,
} from '../src/components/hexagonoids/constants'

describe('constants', () => {
  test('ROCK_TOTAL_VALUE accounts for 1 large, 2 medium, 4 small rocks', () => {
    expect(ROCK_TOTAL_VALUE).toBe(1050)
  })

  test('ROCK_WAVE_MIN_SCORES starts at 0 and is ascending', () => {
    expect(ROCK_WAVE_MIN_SCORES[0]).toBe(0)

    for (let i = 1; i < ROCK_WAVE_MIN_SCORES.length; i++) {
      expect(ROCK_WAVE_MIN_SCORES[i]).toBeGreaterThan(
        ROCK_WAVE_MIN_SCORES[i - 1]!
      )
    }
  })
})
