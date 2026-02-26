// ── Frame / timing ───────────────────────────────────────────────────────────

/** Maximum milliseconds between frames (30 fps) */
export const MAX_DELTA = 1000 / 30

/** Maximum milliseconds to ease */
export const MAX_DURATION = 1000

// ── Sphere ───────────────────────────────────────────────────────────────────

/** Radius of the surface sphere */
export const RADIUS = 5

// ── Ship movement ────────────────────────────────────────────────────────────

/** Radians to turn per second */
export const TURN_RATE = 2.2 * Math.PI

/** The maximum distance in radians an object can pitch forward in a single tick */
const MAX_DISTANCE = Math.PI

/** Maximum ship speed in radians per second */
export const MAX_SPEED = MAX_DISTANCE / 10

/** Increase in velocity in radians per second */
export const ACCELERATION_RATE = MAX_SPEED * 1.55

/**
 * Strength of the friction (exponential decay coefficient).
 * Used in: Math.exp(-FRICTION_COEFFICIENT * dt)
 */
export const FRICTION_COEFFICIENT = 0.35

// ── Bullet ───────────────────────────────────────────────────────────────────

/** Time in milliseconds to wait between shots */
export const FIRE_COOLDOWN = 1000 * 0.15

/** Bullet speed in radians per second */
export const BULLET_SPEED = MAX_SPEED

/** Maximum bullet age in milliseconds */
export const BULLET_LIFETIME = FIRE_COOLDOWN * 6

/** Pitch distance in radians from the center of the ship to the gun tip */
export const GUN_DISTANCE = Math.PI / 180

// ── Rock sizes ───────────────────────────────────────────────────────────────

export const ROCK_LARGE_SIZE: 2 = 2
export const ROCK_MEDIUM_SIZE: 1 = 1
export const ROCK_SMALL_SIZE: 0 = 0

// ── Rock speeds ──────────────────────────────────────────────────────────────

export const ROCK_LARGE_SPEED = MAX_SPEED / (17 / 4)
export const ROCK_MEDIUM_SPEED = MAX_SPEED / (17 / 5)
export const ROCK_SMALL_SPEED = MAX_SPEED / (17 / 6.5)

// ── Rock point values ────────────────────────────────────────────────────────

export const ROCK_LARGE_VALUE = 50
export const ROCK_MEDIUM_VALUE = 100
export const ROCK_SMALL_VALUE = 200

/** Total value of destroying one large rock and all its children */
export const ROCK_TOTAL_VALUE =
  ROCK_LARGE_VALUE * 1 + ROCK_MEDIUM_VALUE * 2 + ROCK_SMALL_VALUE * 4

// ── Rock split ───────────────────────────────────────────────────────────────

const DEG_TO_RAD = Math.PI / 180

export const SPLIT_ROLL_DISTANCE = 1 * DEG_TO_RAD
export const SPLIT_HEADING_OFFSET = 20 * DEG_TO_RAD

// ── Rock collision radii ─────────────────────────────────────────────────────

export const SHIP_RADIUS = 0.11
export const BULLET_RADIUS = SHIP_RADIUS / 12
export const ROCK_SMALL_RADIUS = SHIP_RADIUS * 0.6
export const ROCK_MEDIUM_RADIUS = SHIP_RADIUS * 1.2
export const ROCK_LARGE_RADIUS = SHIP_RADIUS * 2.4

// ── Ship value ───────────────────────────────────────────────────────────────

export const SHIP_VALUE = 400

// ── Player ───────────────────────────────────────────────────────────────────

export const PLAYER_STARTING_LIVES = 3

// ── Regeneration ─────────────────────────────────────────────────────────────

/** Time in milliseconds to make a ship invulnerable after regenerating */
export const SHIP_REGENERATION_GRACE_PERIOD = 1000 * 2
export const SHIP_REGENERATION_WAIT_PERIOD = 1000 * 1

// ── Waves ────────────────────────────────────────────────────────────────────

export const ROCK_WAVE_PERIOD = 1000 * 5

/** Don't spawn a wave if any rock is within this distance (radians) of the player */
export const ROCK_ENCOUNTER_DISTANCE = 20 * DEG_TO_RAD

/** After encountering a nearby rock, wait this long before checking again */
export const ROCK_ENCOUNTER_COOLDOWN = 1000 * 1

/** Grace period before the first wave spawns after starting/restarting */
export const ROCK_WAVE_GRACE_PERIOD = 1000 * 2

/** Maximum number of rocks allowed at once */
export const MAX_ROCKS = 50

/** Number of large rocks per wave (indexed by wave number) */
export const ROCK_WAVE_SIZES = [4, 6, 8, 10, 11]

/** Minimum spawn distance from player in degrees */
export const ROCK_SPAWN_MIN_DISTANCE = 45

/** Maximum spawn distance from player in degrees */
export const ROCK_SPAWN_MAX_DISTANCE = 60
