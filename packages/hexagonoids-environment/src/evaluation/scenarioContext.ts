import {
  SHIP_REGENERATION_GRACE_PERIOD,
  SHIP_REGENERATION_WAIT_PERIOD,
} from '@heygrady/hexagonoids-engine'

/**
 * Compute the maximum number of deaths physically possible in a scenario,
 * accounting for the death cycle (wait period + invulnerability grace period).
 *
 * After dying, the player waits SHIP_REGENERATION_WAIT_PERIOD (1000ms) then
 * respawns with SHIP_REGENERATION_GRACE_PERIOD (2000ms) of invulnerability.
 * The first death can happen immediately, but each subsequent death requires
 * a full 3000ms cycle (~91 ticks at 33ms).
 *
 * `lives` is "extra lives remaining" — with 0 lives the player is still alive
 * and can die once (game over). Total survivable deaths = lives + 1.
 */
export function scenarioPossibleDeaths(
  lives: number,
  maxTicks: number,
  dtMs: number
): number {
  if (lives < 0 || maxTicks <= 0) return 0
  const deathCycleTicks = Math.ceil(
    (SHIP_REGENERATION_WAIT_PERIOD + SHIP_REGENERATION_GRACE_PERIOD) / dtMs
  )
  // First death at tick 0, each subsequent requires a full cycle
  const maxDeaths = 1 + Math.floor(Math.max(maxTicks - 1, 0) / deathCycleTicks)
  return Math.min(maxDeaths, lives + 1)
}
