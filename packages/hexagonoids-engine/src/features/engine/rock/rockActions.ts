import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import type { RNG } from '@neat-evolution/utils'

import {
  MAX_ROCKS,
  ROCK_LARGE_SIZE,
  ROCK_LARGE_SPEED,
  ROCK_MEDIUM_SIZE,
  ROCK_MEDIUM_SPEED,
  ROCK_SMALL_SIZE,
  ROCK_SMALL_SPEED,
  ROCK_SPAWN_MAX_DISTANCE,
  ROCK_SPAWN_MIN_DISTANCE,
  ROCK_WAVE_SIZES,
  SPLIT_HEADING_OFFSET,
  SPLIT_ROLL_DISTANCE,
} from '../constants.js'
import { defaultRockState } from '../defaults.js'
import { generateId } from '../generateId.js'
import { latLngToQuaternion, quaternionToLatLng } from '../physics/latLng.js'
import { headingToAngularVelocity } from '../physics/quaternionPhysics.js'
import type { GameState, RockState } from '../types.js'
import { rockValueForSize } from './rockHelpers.js'

function rockSpeedForSize(size: 0 | 1 | 2): number {
  switch (size) {
    case ROCK_LARGE_SIZE:
      return ROCK_LARGE_SPEED
    case ROCK_MEDIUM_SIZE:
      return ROCK_MEDIUM_SPEED
    case ROCK_SMALL_SIZE:
      return ROCK_SMALL_SPEED
  }
}

/**
 * Spawn a rock at a position with random velocity.
 */
export function spawnRock(
  game: GameState,
  lat: number,
  lng: number,
  size: 0 | 1 | 2,
  rng: RNG
): RockState {
  const id = generateId('rock')
  const orientation = latLngToQuaternion(lat, lng)
  const speed = rockSpeedForSize(size)
  const randomHeading = rng.gen() * Math.PI * 2
  const angularVelocity = headingToAngularVelocity(
    orientation,
    randomHeading,
    speed
  )

  const rock: RockState = {
    ...defaultRockState,
    id,
    orientation,
    lat,
    lng,
    angularVelocity,
    size,
    value: rockValueForSize(size),
  }
  game.rocks.set(id, rock)
  return rock
}

/**
 * Remove a rock from the game.
 */
export function destroyRock(game: GameState, rockId: string): void {
  game.rocks.delete(rockId)
}

/**
 * Split a rock into two smaller rocks (or destroy if size 0).
 */
export function splitRock(game: GameState, rock: RockState, rng: RNG): void {
  if (rock.size === ROCK_SMALL_SIZE) {
    destroyRock(game, rock.id)
    return
  }

  const newSize = (rock.size - 1) as 0 | 1
  const side = rng.gen() < 0.5 ? -1 : 1

  for (const s of [side, -side]) {
    // Offset position via roll
    const roll = SPLIT_ROLL_DISTANCE * s * rng.gen()
    const childOrientation = rock.orientation.multiply(
      Quaternion.RotationYawPitchRoll(0, 0, roll)
    )
    childOrientation.normalize()

    // Offset velocity direction
    const parentWorldUp = Vector3.Up().applyRotationQuaternion(rock.orientation)
    const headingOffset =
      rng.gen() * SPLIT_HEADING_OFFSET * (rng.gen() > 0.5 ? 1 : -1)
    const offsetRotation = Quaternion.RotationAxis(parentWorldUp, headingOffset)
    const childVelocity =
      rock.angularVelocity.applyRotationQuaternion(offsetRotation)

    const [lat, lng] = quaternionToLatLng(childOrientation)

    const id = generateId('rock')
    const child: RockState = {
      ...defaultRockState,
      id,
      orientation: childOrientation,
      lat,
      lng,
      angularVelocity: childVelocity,
      size: newSize,
      value: rockValueForSize(newSize),
    }
    game.rocks.set(id, child)
  }

  destroyRock(game, rock.id)
}

export interface SpawnWaveOptions {
  /** Override minimum spawn distance in degrees (default: ROCK_SPAWN_MIN_DISTANCE) */
  minDistance?: number
  /** Override maximum spawn distance in degrees (default: ROCK_SPAWN_MAX_DISTANCE) */
  maxDistance?: number
}

/**
 * Spawn a wave of rocks around a position.
 * By default, rocks spawn beyond the camera horizon (45-60 degrees) so they
 * appear off-screen and drift into view. Pass options to override distances
 * (e.g. for attract-mode rocks that should be immediately visible).
 */
export function spawnWave(
  game: GameState,
  centerLat: number,
  centerLng: number,
  rng: RNG,
  options?: SpawnWaveOptions
): void {
  const waveIndex = Math.min(game.wave, ROCK_WAVE_SIZES.length - 1)
  const count = ROCK_WAVE_SIZES[waveIndex] ?? 0
  const minDist = options?.minDistance ?? ROCK_SPAWN_MIN_DISTANCE
  const maxDist = options?.maxDistance ?? ROCK_SPAWN_MAX_DISTANCE
  const range = maxDist - minDist

  for (let i = 0; i < count && game.rocks.size < MAX_ROCKS; i++) {
    const angle = rng.gen() * Math.PI * 2
    const distanceDeg = minDist + rng.gen() * range
    const spawnLat = Math.max(
      -90,
      Math.min(90, centerLat + Math.sin(angle) * distanceDeg)
    )
    const spawnLng = centerLng + Math.cos(angle) * distanceDeg
    spawnRock(game, spawnLat, spawnLng, ROCK_LARGE_SIZE, rng)
  }

  game.wave++
}
