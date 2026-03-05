import {
  MAX_SPEED,
  RADIUS,
  ROCK_SMALL_SPEED,
  ROCK_SPAWN_BORDER_HALF_WIDTH,
} from '@heygrady/hexagonoids-engine'

const DEG_TO_RAD = Math.PI / 180

/** Angular radius of the sphere of influence in radians. */
export const SOI_ANGULAR_RADIUS = ROCK_SPAWN_BORDER_HALF_WIDTH * DEG_TO_RAD

/**
 * Arc distance of the SOI on the sphere surface (world units).
 * Anchored to the spawn rectangle long side so rocks are visible
 * well before they reach the ship from any direction.
 */
export const SOI_ARC_DISTANCE = SOI_ANGULAR_RADIUS * RADIUS

/** Maximum closing speed between ship and rock (rad/s) */
export const MAX_CLOSING_SPEED = MAX_SPEED + ROCK_SMALL_SPEED
