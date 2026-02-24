import { MAX_DURATION, TURN_RATE } from '../constants.js'
import type { ShipState } from '../types.js'

/**
 * Easing function: circle out — sqrt(1 - (t - 1)^2)
 * Equivalent to d3-ease easeCircleOut.
 */
const easeCircleOut = (t: number): number => Math.sqrt(1 - (t - 1) ** 2)

/**
 * Rotate the ship's yaw by the given direction.
 * Mutates `ship.yaw`.
 *
 * @param ship - The ship state to mutate
 * @param direction - Turn direction: -1 (left) or 1 (right)
 * @param dtMs - Time delta in milliseconds
 * @param duration - Milliseconds of continuous turning (for easing). Pass dtMs on first frame.
 */
export const turnShip = (
  ship: ShipState,
  direction: -1 | 1,
  dtMs: number,
  duration: number
): void => {
  // Ease magnitude from 0% to 100% over MAX_DURATION
  const t = Math.max(0, Math.min(1, duration / MAX_DURATION))
  const et = easeCircleOut(t)

  const magnitude = ((et * TURN_RATE) / 1000) * dtMs
  const diff = direction * magnitude

  if (diff === 0) {
    return
  }

  ship.yaw = ship.yaw + diff
}
