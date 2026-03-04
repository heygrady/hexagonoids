import {
  createGame,
  type EngineInstance,
  ROCK_LARGE_SPEED,
  ROCK_MEDIUM_SPEED,
  ROCK_SMALL_SPEED,
  spawnRock,
  startPlayer,
} from '@heygrady/hexagonoids-engine'

import { SOI_ANGULAR_RADIUS } from '../utils/constants.js'

import { destinationOnSphere, headingToward } from './sphereUtils.js'

export type ConeIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

export type ScenarioVariant =
  | 'direct-towards'
  | 'direct-away'
  | 'lateral-left'
  | 'lateral-right'

export interface CurriculumScenarioParams {
  coneIndex: ConeIndex
  variant: ScenarioVariant
  rockSize: 0 | 1 | 2
  /** Jitter within cone, normalized to +-0.8 of cone half-width. */
  lateralOffset: number
}

export interface CurriculumGameState {
  engine: EngineInstance
  maxTicks: number
}

const PLAYER_ID = 'player-1'

/** Close distance for direct-away variant (radians). */
const CLOSE_DISTANCE = 0.08

/** Perpendicular offset for lateral variants (radians). */
const LATERAL_DISTANCE = 0.15

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
 * Create a game state with a single rock positioned relative to the ship
 * according to the curriculum scenario parameters.
 *
 * The ship spawns at a seeded random position via startPlayer().
 * One rock is placed in the specified cone direction with the given variant.
 * Wave spawning is suppressed so only the single rock exists.
 */
export function createCurriculumGameState(
  params: CurriculumScenarioParams,
  seed: string,
  dtMs: number
): CurriculumGameState {
  const { coneIndex, variant, rockSize, lateralOffset } = params

  // 1. Create game and start player
  const engine = createGame({ seed, useFastThrust: true })
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
  const sx = ship.x ?? 0
  const sy = ship.y ?? 1
  const sz = ship.z ?? 0
  const yaw = ship.yaw

  // 3. Compute cone direction relative to ship yaw (engine convention: 0=east, CW positive)
  const shipYaw = yaw
  const coneHalfWidth = Math.PI / 8 // PI/4 / 2
  const coneYaw =
    shipYaw + coneIndex * (Math.PI / 4) + lateralOffset * coneHalfWidth

  // 4. Compute rock position and heading based on variant
  let rx: number, ry: number, rz: number
  let rockHeading: number

  const speed = rockSpeedForSize(rockSize)

  switch (variant) {
    case 'direct-towards': {
      // Rock at SOI edge in cone direction, heading back toward ship
      ;[rx, ry, rz] = destinationOnSphere(
        sx,
        sy,
        sz,
        coneYaw,
        SOI_ANGULAR_RADIUS
      )
      rockHeading = headingToward(rx, ry, rz, sx, sy, sz)
      break
    }
    case 'direct-away': {
      // Rock close to ship, heading away from ship
      ;[rx, ry, rz] = destinationOnSphere(sx, sy, sz, coneYaw, CLOSE_DISTANCE)
      // Heading opposite of toward-ship
      rockHeading = headingToward(rx, ry, rz, sx, sy, sz) + Math.PI
      break
    }
    case 'lateral-left': {
      // Rock at south edge of cone, crossing left (north) across the cone
      ;[rx, ry, rz] = destinationOnSphere(
        sx,
        sy,
        sz,
        coneYaw + coneHalfWidth,
        LATERAL_DISTANCE
      )
      rockHeading = headingToward(rx, ry, rz, sx, sy, sz) + Math.PI / 2
      break
    }
    case 'lateral-right': {
      // Rock at north edge of cone, crossing right (south) across the cone
      ;[rx, ry, rz] = destinationOnSphere(
        sx,
        sy,
        sz,
        coneYaw - coneHalfWidth,
        LATERAL_DISTANCE
      )
      rockHeading = headingToward(rx, ry, rz, sx, sy, sz) - Math.PI / 2
      break
    }
  }

  // 5. Spawn the rock directly from the unit point
  spawnRock(state, { x: rx, y: ry, z: rz }, rockSize, rng, rockHeading)

  // 6. Suppress wave spawning
  player.nextWaveCheckAt = state.now + 999999
  player.lastRockEncounterAt = state.now

  // 7. Compute tick budget: 3x travel time (generous for edge placements and agent reaction)
  const travelTime = SOI_ANGULAR_RADIUS / speed // seconds
  const tickBudget = Math.ceil((3 * travelTime) / (dtMs / 1000))

  return { engine, maxTicks: tickBudget }
}
