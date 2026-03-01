import {
  ROCK_LARGE_SIZE,
  ROCK_MEDIUM_SIZE,
  ROCK_SMALL_SIZE,
  ROCK_WAVE_SIZES,
  SHIP_REGENERATION_GRACE_PERIOD,
  SHIP_REGENERATION_WAIT_PERIOD,
} from '@heygrady/hexagonoids-engine'

import type { ScenarioRockState } from '../scenarios/types.js'

/**
 * Per-rock-size destruction tree (total destroyable rocks including children):
 *   Large  (size 2) → 1 large + 2 medium + 4 small = 7 rocks
 *   Medium (size 1) → 1 medium + 2 small            = 3 rocks
 *   Small  (size 0) → 1 rock                         = 1 rock
 */
const ROCKS_PER_SIZE: Record<number, number> = {
  [ROCK_LARGE_SIZE]: 1 + 2 + 4,
  [ROCK_MEDIUM_SIZE]: 1 + 2,
  [ROCK_SMALL_SIZE]: 1,
}

/**
 * Compute the total destroyable rocks for a given set of scenario rocks.
 */
export function scenarioMaximums(rocks: ScenarioRockState[]): {
  maxRocksDestroyed: number
} {
  let maxRocksDestroyed = 0
  for (const rock of rocks) {
    maxRocksDestroyed += ROCKS_PER_SIZE[rock.size] ?? 0
  }
  return { maxRocksDestroyed }
}

/**
 * Compute maximums for a standard full game (wave 0 starting rocks).
 * Wave 0 starts with ROCK_WAVE_SIZES[0] large rocks.
 */
export function fullGameMaximums(): {
  maxRocksDestroyed: number
} {
  const largeCount = ROCK_WAVE_SIZES[0] ?? 4
  return {
    maxRocksDestroyed: largeCount * (ROCKS_PER_SIZE[ROCK_LARGE_SIZE] ?? 7),
  }
}

/**
 * Compute the maximum number of deaths physically possible in a scenario,
 * accounting for the death cycle (wait period + invulnerability grace period).
 *
 * After dying, the player waits SHIP_REGENERATION_WAIT_PERIOD (1000ms) then
 * respawns with SHIP_REGENERATION_GRACE_PERIOD (2000ms) of invulnerability.
 * The first death can happen immediately, but each subsequent death requires
 * a full 3000ms cycle (~91 ticks at 33ms).
 *
 * Result is capped by the number of starting lives.
 */
export function scenarioPossibleDeaths(
  lives: number,
  maxTicks: number,
  dtMs: number
): number {
  if (lives <= 0 || maxTicks <= 0) return 0
  const deathCycleTicks = Math.ceil(
    (SHIP_REGENERATION_WAIT_PERIOD + SHIP_REGENERATION_GRACE_PERIOD) / dtMs
  )
  // First death at tick 0, each subsequent requires a full cycle
  const maxDeaths = 1 + Math.floor(Math.max(maxTicks - 1, 0) / deathCycleTicks)
  return Math.min(maxDeaths, lives)
}
