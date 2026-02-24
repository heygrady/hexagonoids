import {
  MAX_SPEED,
  RADIUS,
  ROCK_LARGE_SPEED,
} from '@heygrady/hexagonoids-engine'

/** Angular radius of the sphere of influence in radians */
export const SOI_ANGULAR_RADIUS = 0.5

/** Arc distance of the SOI on the sphere surface (world units) */
export const SOI_ARC_DISTANCE = SOI_ANGULAR_RADIUS * RADIUS

/** Number of sectors for ego-centric encoding */
export const SECTOR_COUNT = 8

/** Maximum closing speed between ship and rock (rad/s) */
export const MAX_CLOSING_SPEED = MAX_SPEED + ROCK_LARGE_SPEED
