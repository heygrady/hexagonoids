import {
  SHIP_REGENERATION_GRACE_PERIOD,
  SHIP_REGENERATION_WAIT_PERIOD,
} from '@heygrady/hexagonoids-engine'

/**
 * Compute the maximum number of deaths physically possible in a given number
 * of ticks, accounting for the death cycle (wait period + invulnerability
 * grace period).
 *
 * After dying, the player waits SHIP_REGENERATION_WAIT_PERIOD (1000ms) then
 * respawns with SHIP_REGENERATION_GRACE_PERIOD (2000ms) of invulnerability.
 * The first death can happen immediately, but each subsequent death requires
 * a full 3000ms cycle (~91 ticks at 33ms).
 *
 * Uses actual elapsed ticks (not configured maxTicks) so that games ending
 * early produce accurate survival gates.
 */
export function computePossibleDeaths(
  elapsedTicks: number,
  dtMs: number
): number {
  if (elapsedTicks <= 0) return 0
  const deathCycleTicks = Math.ceil(
    (SHIP_REGENERATION_WAIT_PERIOD + SHIP_REGENERATION_GRACE_PERIOD) / dtMs
  )
  return 1 + Math.floor(Math.max(elapsedTicks - 1, 0) / deathCycleTicks)
}
