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
  ROCK_SPAWN_BORDER_HALF_HEIGHT,
  ROCK_SPAWN_BORDER_HALF_WIDTH,
  ROCK_SPAWN_INWARD_SPREAD_DEGREES,
  ROCK_SPAWN_RELEASE_PADDING,
  ROCK_WAVE_SIZES,
  SPLIT_BASE_SPEED_WEIGHT,
  SPLIT_HEADING_OFFSET,
  SPLIT_PARENT_INHERITANCE,
  SPLIT_ROLL_DISTANCE,
  SPLIT_SPEED_JITTER,
  SPLIT_SPEED_MAX_FACTOR,
  SPLIT_SPEED_MIN_FACTOR,
} from '../constants.js'
import { defaultRockState } from '../defaults.js'
import { generateId } from '../generateId.js'
import {
  latLngToQuaternion,
  latLngToUnitPoint,
  latLngToVector3,
  quaternionToLatLng,
  vector3ToLatLng,
} from '../physics/latLng.js'
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
  rng: RNG,
  localHeading?: number
): RockState {
  const id = generateId('rock')
  const orientation = latLngToQuaternion(lat, lng)
  const [x, y, z] = latLngToUnitPoint(lat, lng)
  const speed = rockSpeedForSize(size)
  const randomHeading = localHeading ?? rng.gen() * Math.PI * 2
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
    x,
    y,
    z,
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
  const parentWorldUp = Vector3.Up().applyRotationQuaternion(rock.orientation)
  const parentSpeed = rock.angularVelocity.length()
  const childBaseSpeed = rockSpeedForSize(newSize)

  for (const side of [-1, 1] as const) {
    // Always push siblings apart with a minimum roll offset.
    const roll = side * SPLIT_ROLL_DISTANCE * (1 + rng.gen() * 0.5)
    const childOrientation = rock.orientation.multiply(
      Quaternion.RotationYawPitchRoll(0, 0, roll)
    )
    childOrientation.normalize()

    // Perturb heading around parent-relative velocity.
    const headingOffset =
      side * SPLIT_HEADING_OFFSET * (0.45 + rng.gen() * 0.55)
    const offsetRotation = Quaternion.RotationAxis(parentWorldUp, headingOffset)
    const childVelocity = rock.angularVelocity
      .clone()
      .applyRotationQuaternion(offsetRotation)

    const normalizedVelocity =
      childVelocity.lengthSquared() > 0.000001
        ? childVelocity.normalize()
        : Vector3.Forward()
            .applyRotationQuaternion(childOrientation)
            .normalize()

    const inherited =
      parentSpeed * SPLIT_PARENT_INHERITANCE +
      childBaseSpeed * SPLIT_BASE_SPEED_WEIGHT
    const jitter = (rng.gen() * 2 - 1) * childBaseSpeed * SPLIT_SPEED_JITTER
    const minSpeed = childBaseSpeed * SPLIT_SPEED_MIN_FACTOR
    const maxSpeed = childBaseSpeed * SPLIT_SPEED_MAX_FACTOR
    const clampedSpeed = Math.max(
      minSpeed,
      Math.min(maxSpeed, inherited + jitter)
    )

    const [lat, lng] = quaternionToLatLng(childOrientation)
    const [x, y, z] = latLngToUnitPoint(lat, lng)

    const id = generateId('rock')
    const child: RockState = {
      ...defaultRockState,
      id,
      orientation: childOrientation,
      lat,
      lng,
      x,
      y,
      z,
      angularVelocity: normalizedVelocity.scale(clampedSpeed),
      size: newSize,
      value: rockValueForSize(newSize),
    }
    game.rocks.set(id, child)
  }

  destroyRock(game, rock.id)
}

export interface SpawnWaveOptions {
  /** Override spawn border half-width in degrees. */
  borderHalfWidth?: number
  /** Override spawn border half-height in degrees. */
  borderHalfHeight?: number
  /** Extra release padding beyond border half extents (degrees). */
  releasePaddingDegrees?: number
  /** Override inward heading spread in degrees (default: ±90). */
  inwardSpreadDegrees?: number
}

export interface SpawnBorderPoint {
  lat: number
  lng: number
  borderT: number
}

export interface SpawnBorderExtents {
  halfWidth: number
  halfHeight: number
}

const DEG_TO_RAD = Math.PI / 180

function wrap01(t: number): number {
  const wrapped = t % 1
  return wrapped < 0 ? wrapped + 1 : wrapped
}

function sampleRectBorder(
  borderT: number,
  halfWidth: number,
  halfHeight: number
): [x: number, y: number] {
  const width = halfWidth * 2
  const height = halfHeight * 2
  const perimeter = width * 2 + height * 2
  const distance = wrap01(borderT) * perimeter

  // Start at top-left, move clockwise around the rectangle.
  if (distance < width) {
    return [-halfWidth + distance, halfHeight]
  }
  if (distance < width + height) {
    return [halfWidth, halfHeight - (distance - width)]
  }
  if (distance < width * 2 + height) {
    return [halfWidth - (distance - (width + height)), -halfHeight]
  }
  return [-halfWidth, -halfHeight + (distance - (width * 2 + height))]
}

export function getSpawnBorderExtents(
  options?: SpawnWaveOptions
): SpawnBorderExtents {
  const releasePadding =
    options?.releasePaddingDegrees ?? ROCK_SPAWN_RELEASE_PADDING
  return {
    halfWidth:
      (options?.borderHalfWidth ?? ROCK_SPAWN_BORDER_HALF_WIDTH) +
      releasePadding,
    halfHeight:
      (options?.borderHalfHeight ?? ROCK_SPAWN_BORDER_HALF_HEIGHT) +
      releasePadding,
  }
}

/**
 * Sample a point on the rectangular spawn border around a center lat/lng.
 * `borderT` wraps at 1 and maps to perimeter length uniformly.
 */
export function sampleSpawnBorderPoint(
  centerLat: number,
  centerLng: number,
  borderT: number,
  options?: SpawnWaveOptions
): SpawnBorderPoint {
  const extents = getSpawnBorderExtents(options)
  const halfWidthDeg = extents.halfWidth
  const halfHeightDeg = extents.halfHeight

  const [xDeg, yDeg] = sampleRectBorder(borderT, halfWidthDeg, halfHeightDeg)
  const xRad = xDeg * DEG_TO_RAD
  const yRad = yDeg * DEG_TO_RAD
  const distance = Math.hypot(xRad, yRad)

  if (distance < 0.00001) {
    return { lat: centerLat, lng: centerLng, borderT: wrap01(borderT) }
  }

  const center = latLngToVector3(centerLat, centerLng, 1).normalize()
  const east = new Vector3(
    -Math.sin(centerLng * DEG_TO_RAD),
    0,
    Math.cos(centerLng * DEG_TO_RAD)
  ).normalize()
  const north = Vector3.Cross(center, east).normalize()

  const tangent = east.scale(xRad).addInPlace(north.scale(yRad))
  const heading = tangent.normalize()
  const rotationAxis = Vector3.Cross(center, heading).normalize()
  const spawn = center.applyRotationQuaternion(
    Quaternion.RotationAxis(rotationAxis, distance)
  )
  const [lat, lng] = vector3ToLatLng(spawn)
  return { lat, lng, borderT: wrap01(borderT) }
}

function headingTowardPoint(
  spawnLat: number,
  spawnLng: number,
  targetLat: number,
  targetLng: number
): number {
  const spawnOrientation = latLngToQuaternion(spawnLat, spawnLng)
  const spawnUp = latLngToVector3(spawnLat, spawnLng, 1).normalize()
  const target = latLngToVector3(targetLat, targetLng, 1).normalize()

  // Project target direction onto spawn tangent plane.
  const targetOnPlane = target.subtract(
    spawnUp.scale(Vector3.Dot(target, spawnUp))
  )
  if (targetOnPlane.lengthSquared() < 0.00001) return 0
  targetOnPlane.normalize()

  const forward = Vector3.Forward().applyRotationQuaternion(spawnOrientation)
  const right = Vector3.Right().applyRotationQuaternion(spawnOrientation)

  return Math.atan2(
    Vector3.Dot(targetOnPlane, right),
    Vector3.Dot(targetOnPlane, forward)
  )
}

/**
 * Spawn a wave of rocks around a position.
 * By default, rocks spawn within a nearby gameplay radius around the center
 * position. Pass options to override distances when needed.
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
  const inwardSpreadRad =
    ((options?.inwardSpreadDegrees ?? ROCK_SPAWN_INWARD_SPREAD_DEGREES) *
      Math.PI) /
    180

  for (let i = 0; i < count && game.rocks.size < MAX_ROCKS; i++) {
    // Stratified sampling avoids clumping all rocks at one side of the border.
    const borderT = (i + rng.gen()) / Math.max(1, count)
    const point = sampleSpawnBorderPoint(centerLat, centerLng, borderT, options)
    const inwardHeading =
      headingTowardPoint(point.lat, point.lng, centerLat, centerLng) +
      (rng.gen() * 2 - 1) * inwardSpreadRad

    spawnRock(game, point.lat, point.lng, ROCK_LARGE_SIZE, rng, inwardHeading)
  }

  game.wave++
}
