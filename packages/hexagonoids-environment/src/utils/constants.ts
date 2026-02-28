import {
  MAX_SPEED,
  RADIUS,
  ROCK_LARGE_SPEED,
  ROCK_SPAWN_BORDER_HALF_WIDTH,
} from '@heygrady/hexagonoids-engine'

const DEG_TO_RAD = Math.PI / 180

/**
 * Arc distance of the SOI on the sphere surface (world units).
 * Anchored to the spawn rectangle long side so rocks are visible
 * well before they reach the ship from any direction.
 */
export const SOI_ARC_DISTANCE =
  ROCK_SPAWN_BORDER_HALF_WIDTH * DEG_TO_RAD * RADIUS

/** Angular radius of the sphere of influence in radians. */
export const SOI_ANGULAR_RADIUS = SOI_ARC_DISTANCE / RADIUS

/** Number of sectors for ego-centric encoding */
export const SECTOR_COUNT = 8

/** Maximum closing speed between ship and rock (rad/s) */
export const MAX_CLOSING_SPEED = MAX_SPEED + ROCK_LARGE_SPEED
