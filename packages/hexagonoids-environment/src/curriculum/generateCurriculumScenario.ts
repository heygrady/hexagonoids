import {
  createGame,
  type EngineInstance,
  ROCK_LARGE_SPEED,
  ROCK_MEDIUM_SPEED,
  ROCK_SMALL_SPEED,
  spawnRock,
  startPlayer,
  vec3,
} from '@heygrady/hexagonoids-engine'
import type { RNG } from '@neat-evolution/utils'

import { SOI_ANGULAR_RADIUS } from '../utils/constants.js'

import { destinationOnSphere, headingToward } from './sphereUtils.js'

/**
 * Approach pattern for curriculum rocks.
 *
 * - `inbound`  — rock at SOI edge heading toward ship
 * - `outbound` — rock near ship heading away
 * - `crossing` — rock cutting across SOI perpendicular to ship-rock line
 * - `glancing` — rock just inside SOI boundary heading tangent to SOI circle
 * - `exiting`  — rock at mid-range heading away at oblique angle
 */
export type CurriculumPattern =
  | 'inbound'
  | 'outbound'
  | 'crossing'
  | 'glancing'
  | 'exiting'

export const ALL_PATTERNS: CurriculumPattern[] = [
  'inbound',
  'outbound',
  'crossing',
  'glancing',
  'exiting',
]

/**
 * Distance class for curriculum rock spawning, expressed as fraction of SOI.
 *
 * - `close`  — 8–20% of SOI (point-blank reaction)
 * - `mid`    — 20–60% of SOI (standard engagement)
 * - `far`    — 60–100% of SOI (edge of perception, plan ahead)
 * - `beyond` — 100–130% of SOI (rock entering SOI during episode, inbound only)
 */
export type DistanceClass = 'close' | 'mid' | 'far' | 'beyond'

export const ALL_DISTANCE_CLASSES: DistanceClass[] = [
  'close',
  'mid',
  'far',
  'beyond',
]

/**
 * Valid pattern × distance combinations. Invalid combos are skipped during
 * sampling and re-rolled to a valid alternative.
 */
const VALID_DISTANCE: Record<CurriculumPattern, Set<DistanceClass>> = {
  inbound: new Set(['mid', 'far', 'beyond']),
  outbound: new Set(['close', 'mid']),
  crossing: new Set(['mid', 'far']),
  glancing: new Set(['far']),
  exiting: new Set(['mid', 'far']),
}

/** Check if a pattern × distance combination is valid. */
export function isValidPatternDistance(
  pattern: CurriculumPattern,
  distance: DistanceClass
): boolean {
  return VALID_DISTANCE[pattern].has(distance)
}

export interface CurriculumScenarioParams {
  /** Radians relative to ship heading, [0, 2π). */
  angle: number
  /** Approach pattern for the primary rock. */
  pattern: CurriculumPattern
  /** Rock size: 0=small, 1=medium, 2=large. */
  rockSize: 0 | 1 | 2
  /** ±offset from pure pattern heading (radians). */
  headingJitter: number
  /** Number of rocks (1–5). Default 1 for backward compat. */
  rockCount?: number
  /** Angular spread for secondary rocks (radians). */
  secondarySpread?: number
  /** Distance class for rock spawn. Default 'far' for backward compat. */
  distance?: DistanceClass
}

export interface CurriculumGameState {
  engine: EngineInstance
  maxTicks: number
}

const PLAYER_ID = 'player-1'

/** Maximum heading jitter (radians, ~20°). */
export const MAX_HEADING_JITTER = Math.PI / 9

function rockSpeedForSize(size: 0 | 1 | 2): number {
  switch (size) {
    case 2:
      return ROCK_LARGE_SPEED
    case 1:
      return ROCK_MEDIUM_SPEED
    case 0:
      return ROCK_SMALL_SPEED
  }
}

/**
 * Resolve distance class to a spawn distance in radians.
 * The actual distance is randomized within the class range using the RNG.
 */
function spawnDistanceForClass(distanceClass: DistanceClass, rng: RNG): number {
  const soi = SOI_ANGULAR_RADIUS
  switch (distanceClass) {
    case 'close':
      // 8–20% of SOI
      return soi * (0.08 + rng.gen() * 0.12)
    case 'mid':
      // 20–60% of SOI
      return soi * (0.2 + rng.gen() * 0.4)
    case 'far':
      // 60–100% of SOI
      return soi * (0.6 + rng.gen() * 0.4)
    case 'beyond':
      // 100–130% of SOI
      return soi * (1.0 + rng.gen() * 0.3)
  }
}

/**
 * Create a game state with rocks positioned relative to the ship
 * according to the curriculum scenario parameters.
 *
 * The ship spawns at a seeded random position via startPlayer().
 * The primary rock is placed at the specified angle with the given pattern.
 * Secondary rocks (if rockCount > 1) are offset from the primary angle
 * within the secondarySpread range, with independent sizes.
 * Wave spawning is suppressed so only the curriculum rocks exist.
 */
export function createCurriculumGameState(
  params: CurriculumScenarioParams,
  seed: string,
  dtMs: number
): CurriculumGameState {
  const {
    angle,
    pattern,
    rockSize,
    headingJitter,
    rockCount = 1,
    secondarySpread = 0,
    distance = 'far',
  } = params

  // 1. Create game and start player
  const engine = createGame({ seed })
  const { state, rng } = engine
  startPlayer(state, PLAYER_ID, rng)

  const player = state.players.get(PLAYER_ID)
  if (player == null) {
    throw new Error('Failed to start player')
  }

  const ship =
    player.shipId != null ? state.ships.get(player.shipId) : undefined
  if (ship == null) {
    throw new Error('Ship not found after startPlayer')
  }

  // 2. Get ship's cached XYZ and yaw
  const sx = ship.position[0]
  const sy = ship.position[1]
  const sz = ship.position[2]
  const yaw = ship.yaw

  // 3. Compute direction relative to ship yaw
  const directionYaw = yaw + angle

  // 4. Spawn primary rock
  const speed = rockSpeedForSize(rockSize)
  const primaryDistance = spawnDistanceForClass(distance, rng)
  spawnRockForPattern(
    state,
    sx,
    sy,
    sz,
    directionYaw,
    pattern,
    rockSize,
    headingJitter,
    primaryDistance,
    rng
  )

  // 5. Spawn secondary rocks at same distance class, independent sizes
  for (let i = 1; i < rockCount; i++) {
    const offsetAngle = directionYaw + (rng.gen() * 2 - 1) * secondarySpread
    const secondarySize = rng.genIntRange(0, 3) as 0 | 1 | 2
    const secondaryJitter = (rng.gen() * 2 - 1) * MAX_HEADING_JITTER
    const secondaryDistance = spawnDistanceForClass(distance, rng)
    spawnRockForPattern(
      state,
      sx,
      sy,
      sz,
      offsetAngle,
      pattern,
      secondarySize,
      secondaryJitter,
      secondaryDistance,
      rng
    )
  }

  // 6. Suppress wave spawning
  player.nextWaveCheckAt = state.now + 999999
  player.lastRockEncounterAt = state.now

  // 7. Compute tick budget based on distance and rock count.
  // Use 1.5× travel time (enough to approach + engage) instead of 3×,
  // and cap at 256 ticks (~8.4s at 33ms) to keep curriculum episodes
  // focused micro-encounters, not mini-games.
  const travelTime = primaryDistance / speed // seconds
  const reactionTime = distance === 'beyond' ? 0.5 : 0
  const KILL_CYCLE_SECONDS = 1.6
  const extraTime = (rockCount - 1) * KILL_CYCLE_SECONDS
  const MAX_CURRICULUM_TICKS = 256
  const rawBudget = Math.ceil(
    (1.5 * travelTime + reactionTime + extraTime) / (dtMs / 1000)
  )
  const tickBudget = Math.min(rawBudget, MAX_CURRICULUM_TICKS)

  return { engine, maxTicks: tickBudget }
}

/**
 * Spawn a single rock using the given pattern at the specified distance
 * from the ship position.
 */
function spawnRockForPattern(
  state: Parameters<typeof spawnRock>[0],
  sx: number,
  sy: number,
  sz: number,
  directionYaw: number,
  pattern: CurriculumPattern,
  rockSize: 0 | 1 | 2,
  headingJitter: number,
  spawnDistance: number,
  rng: RNG
): void {
  let rx: number, ry: number, rz: number
  let rockHeading: number

  switch (pattern) {
    case 'inbound': {
      // Rock at distance in cone direction, heading toward ship
      ;[rx, ry, rz] = destinationOnSphere(
        sx,
        sy,
        sz,
        directionYaw,
        spawnDistance
      )
      rockHeading = headingToward(rx, ry, rz, sx, sy, sz) + headingJitter
      break
    }
    case 'outbound': {
      // Rock near ship, heading away
      ;[rx, ry, rz] = destinationOnSphere(
        sx,
        sy,
        sz,
        directionYaw,
        spawnDistance
      )
      rockHeading =
        headingToward(rx, ry, rz, sx, sy, sz) + Math.PI + headingJitter
      break
    }
    case 'crossing': {
      // Rock at distance, heading perpendicular to ship-rock line
      ;[rx, ry, rz] = destinationOnSphere(
        sx,
        sy,
        sz,
        directionYaw,
        spawnDistance
      )
      rockHeading =
        headingToward(rx, ry, rz, sx, sy, sz) + Math.PI / 2 + headingJitter
      break
    }
    case 'glancing': {
      // Rock at distance, heading tangent to SOI circle
      ;[rx, ry, rz] = destinationOnSphere(
        sx,
        sy,
        sz,
        directionYaw,
        spawnDistance
      )
      const towardShip = headingToward(rx, ry, rz, sx, sy, sz)
      rockHeading = towardShip + Math.PI / 2 + 0.15 + headingJitter
      break
    }
    case 'exiting': {
      // Rock at distance heading away at oblique angle
      ;[rx, ry, rz] = destinationOnSphere(
        sx,
        sy,
        sz,
        directionYaw,
        spawnDistance
      )
      const exitToward = headingToward(rx, ry, rz, sx, sy, sz)
      rockHeading = exitToward + Math.PI / 2 + headingJitter
      break
    }
  }

  spawnRock(state, vec3(rx, ry, rz), rockSize, rng, rockHeading)
}
