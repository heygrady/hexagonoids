import { degToRad } from './geoCoords/degToRad'

/** Maximum milliseconds between frames */
export const MAX_DELTA = 1000 / 30 // 30 frames a second

/** Maximum milliseconds to ease */
export const MAX_DURATION = 1000

/** Time in milliseconds between toggles of the tail visibility state */
export const TAIL_BLINK_DURATION = 125

/** Radians to turn per second */
export const TURN_RATE = 2.2 * Math.PI

/** Radius of the surface sphere */
export const RADIUS = 5
export const CAMERA_HEIGHT = 2.4
export const CAMERA_RADIUS = RADIUS + CAMERA_HEIGHT
export const SPOTLIGHT_HEIGHT = 4

export const SCREEN_EDGE_BUFFER = 0.35 // 0.2 is too close, 0.4 is too far

/** The maximum distance in radians an object can pitch forward in a single tick */
const MAX_DISTANCE = Math.PI

/** Maximum ship speed in radians per second */
export const MAX_SPEED = MAX_DISTANCE / 10

/** Pitch distance in radians from the center of the ship to the gun tip */
export const GUN_DISTANCE = Math.PI / 180
export const SPLIT_ROLL_DISTANCE = degToRad(1)
export const SPLIT_HEADING_OFFSET = degToRad(20)

/** Bullet speed in radians per second */
export const BULLET_SPEED = MAX_SPEED
export const MAX_BULLET_SPEED = MAX_SPEED + BULLET_SPEED

export const EXPLOSION_LARGE_SPEED = BULLET_SPEED / 6
export const EXPLOSION_MEDIUM_SPEED = BULLET_SPEED / 8
export const EXPLOSION_SMALL_SPEED = BULLET_SPEED / 10

export const ROCK_LARGE_SPEED = MAX_SPEED / (17 / 4)
export const ROCK_MEDIUM_SPEED = MAX_SPEED / (17 / 5)
export const ROCK_SMALL_SPEED = MAX_SPEED / (17 / 6.5)

/** Increase in velocity in radians per second */
export const ACCELERATION_RATE = MAX_SPEED * 1.55

/** Strength of the friction */
export const FRICTION_COEFFICIENT = Math.PI / 425

export const SHIP_SCALE = 2 / 1000
export const BULLET_SCALE = (12 * 1) / 1000

export const ROCK_SMALL_SCALE = (15 * 1) / 1000
export const ROCK_MEDIUM_SCALE = 1.2 * (ROCK_SMALL_SCALE / 0.6)
export const ROCK_LARGE_SCALE = 2.4 * (ROCK_SMALL_SCALE / 0.6)

/** Time in milliseconds to wait between shots */
export const FIRE_COOLDOWN = 1000 * 0.15

/** Maximum bullet age in milliseconds. The bullet will be released to the pool after this time. */
export const BULLET_LIFETIME = FIRE_COOLDOWN * 6
export const EXPLOSION_LARGE_LIFETIME = BULLET_LIFETIME / 1.5
export const EXPLOSION_MEDIUM_LIFETIME = BULLET_LIFETIME / 2
export const EXPLOSION_SMALL_LIFETIME = BULLET_LIFETIME / 3

/** H3 resolution used for bullet collisions */
export const BULLET_RESOLUTION = 4

// FIXME: are these resolutions used anywhere?
export const ROCK_LARGE_RESOLUTION = 1
export const ROCK_MEDIUM_RESOLUTION = 2
export const ROCK_SMALL_RESOLUTION = 2
export const SHIP_RESOLUTION = 2

export const SHIP_RADIUS = 0.11
export const BULLET_RADIUS = SHIP_RADIUS / 12
export const ROCK_SMALL_RADIUS = SHIP_RADIUS * 0.6 // 0.6
export const ROCK_MEDIUM_RADIUS = SHIP_RADIUS * 1.2 // 1.2
export const ROCK_LARGE_RADIUS = SHIP_RADIUS * 2.4 // 2.4

/** Maximum number of ships to keep in cache pools */
export const SHIP_CACHE_SIZE = 2

/** Maximum number of rocks to keep in cache pools */
export const MAX_ROCKS = 40
export const ROCK_CACHE_SIZE = 11 // max wave size

/** Maximum number of bullets to keep in cache pools */
export const BULLET_CACHE_SIZE = SHIP_CACHE_SIZE * 6 + 18 // spare bullets per ship plus three explosions

/** Maximum number of cells to keep in cache pools */
// res 0 = 122; 1 = 842; 2 = 5882
export const CELL_CACHE_SIZE = 30 // over 500 and it takes up too much memory

export const ROCK_LARGE_SIZE = 2
export const ROCK_MEDIUM_SIZE = 1
export const ROCK_SMALL_SIZE = 0

export const ROCK_LARGE_VALUE = 50
export const ROCK_MEDIUM_VALUE = 100
export const ROCK_SMALL_VALUE = 200
export const ROCK_TOTAL_VALUE =
  ROCK_LARGE_VALUE * 1 + ROCK_MEDIUM_VALUE * 2 + ROCK_SMALL_VALUE * 4

export const SHIP_VALUE = 400

export const PLAYER_STARTING_LIVES = 3

export const CELL_VISITED_DURATION = MAX_DURATION * 2
export const CELL_IMPACTED_DURATION = MAX_DURATION * 10
export const CELL_VISITED_OPACITY = 0.35
export const CELL_IMPACTED_OPACITY = 1

/** Time in milliseconds to make a ship invulnerable after regenerating */
export const SHIP_REGENERATION_GRACE_PERIOD = 1000 * 2
export const SHIP_REGENERATION_WAIT_PERIOD = 1000 * 1

export const ROCK_WAVE_PERIOD = 1000 * 5
export const ROCK_ENCOUNTER_COOLDOWN = 1000 * 1

// https://ronjeffries.com/articles/020-asteroids/asteroids-23/
export const ROCK_WAVE_SIZES = [4, 6, 8, 10, 11]
export const ROCK_WAVE_MIN_SCORES = ROCK_WAVE_SIZES.map((n, i) => {
  let score = 0
  for (let j = i; j > 0; j--) {
    score += n * ROCK_TOTAL_VALUE
  }
  return score
})
