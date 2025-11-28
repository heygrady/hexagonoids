/**
 * Shared Glicko-2 rating system constants.
 * These settings match the GlickoStrategy configuration in tournament-strategy package.
 */

export const GLICKO_TAU = 0.5
export const GLICKO_DEFAULT_RATING = 1500
export const GLICKO_DEFAULT_RD = 350
export const GLICKO_DEFAULT_VOL = 0.06

/**
 * Sliding Window Glicko-2 constants for player rating calculations.
 * Lower tau prevents wild swings with frequent updates.
 * RD floor keeps player responsive to wins/losses.
 */
export const PLAYER_GLICKO_TAU = 0.35 // Lower than default for sliding window
export const PLAYER_GLICKO_RD_FLOOR = 60 // Minimum RD to keep responsiveness
export const GLICKO_WINDOW_SIZE = 15 // Number of past matches in sliding window
export const GLICKO_MAX_HISTORY = 50 // Maximum match history to retain

/**
 * Glicko-2 settings object for creating Glicko2 instances.
 */
export const GLICKO_SETTINGS = {
  tau: GLICKO_TAU,
  rating: GLICKO_DEFAULT_RATING,
  rd: GLICKO_DEFAULT_RD,
  vol: GLICKO_DEFAULT_VOL,
} as const

/**
 * Player-specific Glicko-2 settings for sliding window calculation.
 */
export const PLAYER_GLICKO_SETTINGS = {
  tau: PLAYER_GLICKO_TAU,
  rating: GLICKO_DEFAULT_RATING,
  rd: GLICKO_DEFAULT_RD,
  vol: GLICKO_DEFAULT_VOL,
} as const

/**
 * Default player Glicko-2 data.
 */
export const DEFAULT_PLAYER_GLICKO_DATA = {
  rating: GLICKO_DEFAULT_RATING,
  rd: GLICKO_DEFAULT_RD,
  vol: GLICKO_DEFAULT_VOL,
} as const
