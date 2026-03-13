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

/** Approximate bullet travel distance in radians over its full lifetime. */
export const BULLET_TRAVEL_DISTANCE = BULLET_SPEED * (BULLET_LIFETIME / 1000)

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
export const SPLIT_SPEED_MIN_FACTOR = 0.78
export const SPLIT_SPEED_MAX_FACTOR = 1.35
export const SPLIT_PARENT_INHERITANCE = 0.65
export const SPLIT_BASE_SPEED_WEIGHT = 0.6
export const SPLIT_SPEED_JITTER = 0.12

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
export const ROCK_WAVE_RETRY_DEFER_PERIOD = 1000 * 0.5
export const ROCK_NO_ENCOUNTER_REPLENISH_DELAY = 1000 * 4

/** Maximum number of rocks allowed at once */
export const MAX_ROCKS = 50

/** Maximum rock count cap scales with score and plateaus. */
export const SCORE_WAVE_WORLD_CAP_BASE = 12
export const SCORE_WAVE_WORLD_CAP_STEP = 5000
export const SCORE_WAVE_WORLD_CAP_MAX = 16
export const ROCK_WORLD_CAP_WAVE_MULTIPLIER = 5

/** High-score "cleared enough" thresholds for remaining world rocks. */
export const SCORE_CLEAR_THRESHOLD_MID = 2
export const SCORE_CLEAR_THRESHOLD_HIGH = 3

/** Score bands for wave pacing rules. */
export const SCORE_BAND_MID_MIN = 5000
export const SCORE_BAND_HIGH_MIN = 20000

/** Delay floor/curve for wave scheduling. */
export const SCORE_WAVE_DELAY_LOW = 5000
export const SCORE_WAVE_DELAY_MID_START = 4500
export const SCORE_WAVE_DELAY_MID_END = 2800
export const SCORE_WAVE_DELAY_HIGH_FLOOR = 1800
export const SCORE_WAVE_DELAY_HIGH_START = 2200

/** Require leftover rocks to be far before advancing under relaxed clear rules. */
export const ROCK_FAR_CLEAR_DISTANCE = 95 * DEG_TO_RAD

/** Number of large rocks per wave (indexed by wave number) */
export const ROCK_WAVE_SIZES = [4, 6, 8, 10, 11]

/** Minimum spawn distance from player in degrees */
export const ROCK_SPAWN_MIN_DISTANCE = 0

/**
 * Half-height of the rectangular spawn border in degrees.
 * Tuned to bullet-range scale so new rocks begin within a playable radius.
 */
export const ROCK_SPAWN_BORDER_HALF_HEIGHT =
  (BULLET_TRAVEL_DISTANCE * 180) / Math.PI

/**
 * Half-width of the rectangular spawn border in degrees.
 * Wider than height to account for landscape viewport shape.
 */
export const ROCK_SPAWN_BORDER_HALF_WIDTH =
  ROCK_SPAWN_BORDER_HALF_HEIGHT * (16 / 9)

/** Random heading spread around inward direction (degrees). */
export const ROCK_SPAWN_INWARD_SPREAD_DEGREES = 60

/** Push release border outward so new large rocks start off-screen (degrees). */
export const ROCK_SPAWN_RELEASE_PADDING =
  ((ROCK_LARGE_RADIUS / RADIUS) * 180) / Math.PI
