import {
  SHIP_REGENERATION_GRACE_PERIOD,
  SHIP_REGENERATION_WAIT_PERIOD,
} from '@heygrady/hexagonoids-engine'

/**
 * Minimum ticks required per rock kill, accounting for rotation, bullet
 * travel, and fire cooldown. Used to cap maxRocksDestroyed by what's
 * physically achievable in the available time.
 */
export const TICKS_PER_KILL = 10

/**
 * Compute the rate-limited maximum destroyable rocks for a scenario.
 *
 * Returns floor(maxTicks / TICKS_PER_KILL) — the maximum number of rocks
 * an agent could physically destroy given the available time. The actual
 * effective maximum used in fitness is min(rateCap, metrics.uniqueRocksSeen),
 * applied inside weightedFitnessSum.
 */
export function scenarioMaximums(maxTicks: number): {
  maxRocksDestroyed: number
} {
  const rateCap = Math.floor(maxTicks / TICKS_PER_KILL)
  return { maxRocksDestroyed: Math.max(1, rateCap) }
}

/**
 * Compute maximums for a standard full game.
 *
 * Same rate-cap formula as scenarios for consistent scoring.
 */
export function fullGameMaximums(maxTicks = 3000): {
  maxRocksDestroyed: number
} {
  const rateCap = Math.floor(maxTicks / TICKS_PER_KILL)
  return { maxRocksDestroyed: Math.max(1, rateCap) }
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
