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
import { generateId } from '../generateId.js'
import { quatFromUnitPoint, quatToUnitPoint } from '../math/quat.js'
import type { Quat, Vec3 } from '../math/types.js'
import {
  vec3Cross,
  vec3Dot,
  vec3Normalize,
  vec3Scale,
  vec3Set,
} from '../math/vec3.js'
import { headingToAngularVelocity } from '../physics/quaternionPhysics.js'
import type { GameState, RockState } from '../types.js'
import { rockValueForSize } from './rockHelpers.js'
import { RockPool } from './rockPool.js'

// Module-scoped pool
const rockPool = new RockPool()

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
 * Spawn a rock at a unit-sphere point with random velocity.
 */
export function spawnRock(
  game: GameState,
  point: Vec3,
  size: 0 | 1 | 2,
  rng: RNG,
  localHeading?: number
): RockState {
  const rock = rockPool.obtain()
  rock.id = generateId('rock')
  rock.size = size
  rock.value = rockValueForSize(size)

  quatFromUnitPoint(rock.orientation, point[0], point[1], point[2])
  const speed = rockSpeedForSize(size)
  const randomHeading = localHeading ?? rng.gen() * Math.PI * 2
  headingToAngularVelocity(
    rock.angularVelocity,
    rock.orientation,
    randomHeading,
    speed
  )
  quatToUnitPoint(rock.position, rock.orientation)

  game.rocks.set(rock.id, rock)
  return rock
}

/** Obtain a rock entity from the pool (all fields stale — caller must overwrite). */
export function obtainRockEntity(): RockState {
  return rockPool.obtain()
}

/** Release a rock entity back to the pool. */
export function releaseRockEntity(rock: RockState): void {
  rockPool.release(rock)
}

/**
 * Remove a rock from the game.
 */
export function destroyRock(game: GameState, rockId: string): void {
  const rock = game.rocks.get(rockId)
  game.rocks.delete(rockId)
  if (rock != null) {
    rockPool.release(rock)
  }
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

  // Parent world-up: rotate (0,1,0) by parent orientation — scalar math
  const pqx = rock.orientation[0]
  const pqy = rock.orientation[1]
  const pqz = rock.orientation[2]
  const pqw = rock.orientation[3]
  const parentUpX = 2 * (pqx * pqy - pqz * pqw)
  const parentUpY = 1 - 2 * (pqx * pqx + pqz * pqz)
  const parentUpZ = 2 * (pqy * pqz + pqx * pqw)

  // Parent speed (vector magnitude)
  const pvx = rock.angularVelocity[0]
  const pvy = rock.angularVelocity[1]
  const pvz = rock.angularVelocity[2]
  const parentSpeed = Math.sqrt(pvx * pvx + pvy * pvy + pvz * pvz)
  const childBaseSpeed = rockSpeedForSize(newSize)

  for (const side of [-1, 1] as const) {
    // Roll quaternion: RotationYawPitchRoll(0, 0, roll) = rotation around Z
    const roll = side * SPLIT_ROLL_DISTANCE * (1 + rng.gen() * 0.5)
    const rollHalf = roll * 0.5
    const rollSin = Math.sin(rollHalf)
    const rollCos = Math.cos(rollHalf)

    // Child orientation = parent * rollQuat (quaternion multiply)
    let cqx = pqw * 0 + pqx * rollCos + pqy * rollSin - pqz * 0
    let cqy = pqw * 0 - pqx * rollSin + pqy * rollCos + pqz * 0
    let cqz = pqw * rollSin + pqx * 0 - pqy * 0 + pqz * rollCos
    let cqw = pqw * rollCos - pqx * 0 - pqy * 0 - pqz * rollSin

    // Normalize child orientation
    const cqLen = Math.sqrt(cqx * cqx + cqy * cqy + cqz * cqz + cqw * cqw)
    if (cqLen > 0.00001) {
      const inv = 1 / cqLen
      cqx *= inv
      cqy *= inv
      cqz *= inv
      cqw *= inv
    }

    // Heading offset: axis-angle rotation around parentWorldUp
    const headingOffset =
      side * SPLIT_HEADING_OFFSET * (0.45 + rng.gen() * 0.55)
    const hHalf = headingOffset * 0.5
    const hSin = Math.sin(hHalf)
    const hCos = Math.cos(hHalf)
    const oqx = parentUpX * hSin
    const oqy = parentUpY * hSin
    const oqz = parentUpZ * hSin
    const oqw = hCos

    // Rotate parent velocity by offsetQuat: v' = q * v * q^-1
    const tx = 2 * (oqy * pvz - oqz * pvy)
    const ty = 2 * (oqz * pvx - oqx * pvz)
    const tz = 2 * (oqx * pvy - oqy * pvx)
    let cvx = pvx + oqw * tx + (oqy * tz - oqz * ty)
    let cvy = pvy + oqw * ty + (oqz * tx - oqx * tz)
    let cvz = pvz + oqw * tz + (oqx * ty - oqy * tx)

    // Normalize child velocity direction
    let cvLenSq = cvx * cvx + cvy * cvy + cvz * cvz
    if (cvLenSq > 0.000001) {
      const invLen = 1 / Math.sqrt(cvLenSq)
      cvx *= invLen
      cvy *= invLen
      cvz *= invLen
    } else {
      // Fallback: rotate (0,0,1) by child orientation
      cvx = 2 * (cqx * cqz + cqy * cqw)
      cvy = 2 * (cqy * cqz - cqx * cqw)
      cvz = 1 - 2 * (cqx * cqx + cqy * cqy)
      cvLenSq = cvx * cvx + cvy * cvy + cvz * cvz
      if (cvLenSq > 0.000001) {
        const invLen = 1 / Math.sqrt(cvLenSq)
        cvx *= invLen
        cvy *= invLen
        cvz *= invLen
      }
    }

    // Speed calculation
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

    const child = rockPool.obtain()
    child.id = generateId('rock')
    child.size = newSize
    child.value = rockValueForSize(newSize)

    child.orientation[0] = cqx
    child.orientation[1] = cqy
    child.orientation[2] = cqz
    child.orientation[3] = cqw
    quatToUnitPoint(child.position, child.orientation)

    child.angularVelocity[0] = cvx * clampedSpeed
    child.angularVelocity[1] = cvy * clampedSpeed
    child.angularVelocity[2] = cvz * clampedSpeed

    game.rocks.set(child.id, child)
  }

  destroyRock(game, rock.id)
}

export interface SpawnWaveOptions {
  borderHalfWidth?: number
  borderHalfHeight?: number
  releasePaddingDegrees?: number
  inwardSpreadDegrees?: number
}

export interface SpawnBorderPoint {
  x: number
  y: number
  z: number
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

// Module-scoped scratch for spawn geometry
const _center = new Float64Array(3) as Vec3
const _east = new Float64Array(3) as Vec3
const _north = new Float64Array(3) as Vec3
const _tangent = new Float64Array(3) as Vec3
const _rotAxis = new Float64Array(3) as Vec3
const _spawn = new Float64Array(3) as Vec3
const _reference = new Float64Array(3) as Vec3
const _spawnQuat = new Float64Array(4) as Quat
const _tmpVec = new Float64Array(3) as Vec3

/**
 * Sample a point on the rectangular spawn border around a unit-sphere center.
 */
export function sampleSpawnBorderPoint(
  centerPoint: Vec3,
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
    return {
      x: centerPoint[0],
      y: centerPoint[1],
      z: centerPoint[2],
      borderT: wrap01(borderT),
    }
  }

  // Normalize center
  vec3Set(_center, centerPoint[0], centerPoint[1], centerPoint[2])
  const cLenSq =
    _center[0] * _center[0] + _center[1] * _center[1] + _center[2] * _center[2]
  if (cLenSq < 0.0000001) {
    return { x: 0, y: 1, z: 0, borderT: wrap01(borderT) }
  }
  vec3Normalize(_center)

  // Reference vector for east/north basis
  if (Math.abs(_center[1]) > 0.95) {
    vec3Set(_reference, 1, 0, 0) // Right
  } else {
    vec3Set(_reference, 0, 1, 0) // Up
  }

  // east = normalize(cross(reference, center))
  vec3Cross(_east, _reference, _center)
  vec3Normalize(_east)

  // north = normalize(cross(center, east))
  vec3Cross(_north, _center, _east)
  vec3Normalize(_north)

  // tangent = east * xRad + north * yRad
  vec3Scale(_tangent, _east, xRad)
  vec3Scale(_tmpVec, _north, yRad)
  _tangent[0] += _tmpVec[0]
  _tangent[1] += _tmpVec[1]
  _tangent[2] += _tmpVec[2]

  // heading = normalize(tangent)
  vec3Normalize(_tangent)

  // rotationAxis = normalize(cross(center, heading))
  vec3Cross(_rotAxis, _center, _tangent)
  vec3Normalize(_rotAxis)

  // spawn = rotate center by axis-angle(rotAxis, distance)
  // Using Rodrigues' rotation: v' = v*cos(a) + (k×v)*sin(a) + k*(k·v)*(1-cos(a))
  const cosA = Math.cos(distance)
  const sinA = Math.sin(distance)
  const kDotV = vec3Dot(_rotAxis, _center)

  // k × v
  vec3Cross(_tmpVec, _rotAxis, _center)

  _spawn[0] =
    _center[0] * cosA + _tmpVec[0] * sinA + _rotAxis[0] * kDotV * (1 - cosA)
  _spawn[1] =
    _center[1] * cosA + _tmpVec[1] * sinA + _rotAxis[1] * kDotV * (1 - cosA)
  _spawn[2] =
    _center[2] * cosA + _tmpVec[2] * sinA + _rotAxis[2] * kDotV * (1 - cosA)
  vec3Normalize(_spawn)

  return {
    x: _spawn[0],
    y: _spawn[1],
    z: _spawn[2],
    borderT: wrap01(borderT),
  }
}

function headingTowardPoint(spawnPoint: Vec3, targetPoint: Vec3): number {
  // Build spawn orientation
  quatFromUnitPoint(_spawnQuat, spawnPoint[0], spawnPoint[1], spawnPoint[2])

  // Normalize spawn normal and target
  vec3Set(_center, spawnPoint[0], spawnPoint[1], spawnPoint[2])
  vec3Normalize(_center)
  vec3Set(_tmpVec, targetPoint[0], targetPoint[1], targetPoint[2])
  vec3Normalize(_tmpVec)

  // Project target onto spawn tangent plane: t - n*(t·n)
  const dotTN = vec3Dot(_tmpVec, _center)
  _tangent[0] = _tmpVec[0] - _center[0] * dotTN
  _tangent[1] = _tmpVec[1] - _center[1] * dotTN
  _tangent[2] = _tmpVec[2] - _center[2] * dotTN

  const tLenSq =
    _tangent[0] * _tangent[0] +
    _tangent[1] * _tangent[1] +
    _tangent[2] * _tangent[2]
  if (tLenSq < 0.00001) return 0
  vec3Normalize(_tangent)

  // Forward = rotate (0,0,1) by spawnQuat
  const sq = _spawnQuat
  const ftx = 2 * sq[1]
  const fty = -2 * sq[0]
  const ftz = 0
  const fx = sq[3] * ftx + (sq[1] * ftz - sq[2] * fty)
  const fy = sq[3] * fty + (sq[2] * ftx - sq[0] * ftz)
  const fz = 1 + sq[3] * ftz + (sq[0] * fty - sq[1] * ftx)

  // Right = rotate (1,0,0) by spawnQuat
  const rtx = 0
  const rty = 2 * sq[2]
  const rtz = -2 * sq[1]
  const rx = 1 + sq[3] * rtx + (sq[1] * rtz - sq[2] * rty)
  const ry = sq[3] * rty + (sq[2] * rtx - sq[0] * rtz)
  const rz = sq[3] * rtz + (sq[0] * rty - sq[1] * rtx)

  const dotForward = _tangent[0] * fx + _tangent[1] * fy + _tangent[2] * fz
  const dotRight = _tangent[0] * rx + _tangent[1] * ry + _tangent[2] * rz

  return Math.atan2(dotRight, dotForward)
}

/**
 * Spawn a wave of rocks around a position.
 */
export function spawnWave(
  game: GameState,
  centerPoint: Vec3,
  rng: RNG,
  options?: SpawnWaveOptions
): void {
  const waveIndex = Math.min(game.wave, ROCK_WAVE_SIZES.length - 1)
  const count = ROCK_WAVE_SIZES[waveIndex] ?? 0
  const inwardSpreadRad =
    ((options?.inwardSpreadDegrees ?? ROCK_SPAWN_INWARD_SPREAD_DEGREES) *
      Math.PI) /
    180

  // Use a temporary Vec3 for spawn border points
  const spawnPt = new Float64Array(3) as Vec3

  for (let i = 0; i < count && game.rocks.size < MAX_ROCKS; i++) {
    const borderT = (i + rng.gen()) / Math.max(1, count)
    const point = sampleSpawnBorderPoint(centerPoint, borderT, options)
    vec3Set(spawnPt, point.x, point.y, point.z)
    const inwardHeading =
      headingTowardPoint(spawnPt, centerPoint) +
      (rng.gen() * 2 - 1) * inwardSpreadRad

    spawnRock(game, spawnPt, ROCK_LARGE_SIZE, rng, inwardHeading)
  }

  game.wave++
}
