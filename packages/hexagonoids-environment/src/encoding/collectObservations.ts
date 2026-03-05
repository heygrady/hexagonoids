import type {
  GameState,
  ManagedSpatialQueries,
  RockState,
  ShipState,
  SpatialPoint,
} from '@heygrady/hexagonoids-engine'
import {
  BULLET_RADIUS,
  BULLET_TRAVEL_DISTANCE,
  MAX_SPEED,
  RADIUS,
  ROCK_LARGE_RADIUS,
  ROCK_MEDIUM_RADIUS,
  ROCK_SMALL_RADIUS,
  SHIP_RADIUS,
} from '@heygrady/hexagonoids-engine'
import { yawToBearing } from '../utils/sphericalBearing.js'
import {
  MAX_CLOSING_SPEED,
  SOI_ANGULAR_RADIUS,
  SOI_ARC_DISTANCE,
} from './constants.js'
import {
  BULLET_RANGE_MULTIPLIER,
  BULLET_SLOTS,
  CONE_COUNT,
} from './encodingPresets.js'
import type {
  BulletHit,
  ConeHit,
  ObservationFrame,
} from './observationTypes.js'

const TWO_PI = Math.PI * 2
// Orthographic distance at bullet range (zero-crossing)
const BULLET_RANGE_ORTHO = Math.sin(
  BULLET_TRAVEL_DISTANCE * BULLET_RANGE_MULTIPLIER
)
// Orthographic distance at hemisphere edge (maximum possible distance)
const MAX_HEMISPHERE_ORTHO = 1.0 // sin(π/2) = 1
const PROJECTION_EPSILON = 1e-6
// Convert entity radii from world units to unit-sphere angular radians
const UNIT_SHIP_RADIUS = SHIP_RADIUS / RADIUS
const UNIT_ROCK_LARGE_RADIUS = ROCK_LARGE_RADIUS / RADIUS
const UNIT_ROCK_MEDIUM_RADIUS = ROCK_MEDIUM_RADIUS / RADIUS
const UNIT_ROCK_SMALL_RADIUS = ROCK_SMALL_RADIUS / RADIUS
const UNIT_BULLET_RADIUS = BULLET_RADIUS / RADIUS
// Precomputed dot-product threshold for SOI culling.
// cos(SOI_ANGULAR_RADIUS) — rocks with dot product below this are outside SOI.
const SOI_DOT_THRESHOLD = Math.cos(SOI_ANGULAR_RADIUS)

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function requireSpatialQueries(
  spatialQueries: Pick<ManagedSpatialQueries, 'queryRocksNear'> | undefined
): Pick<ManagedSpatialQueries, 'queryRocksNear'> {
  if (spatialQueries == null) {
    throw new Error(
      'collectObservations requires spatialQueries when computing rock perception'
    )
  }
  return spatialQueries
}

function buildLocalBasisFromCenter(center: SpatialPoint): {
  northX: number
  northY: number
  northZ: number
  eastX: number
  eastY: number
  eastZ: number
} {
  const refX = 0
  const refY = Math.abs(center.y) > 0.99 ? 0 : 1
  const refZ = Math.abs(center.y) > 0.99 ? 1 : 0

  let eastX = refY * center.z - refZ * center.y
  let eastY = refZ * center.x - refX * center.z
  let eastZ = refX * center.y - refY * center.x
  const eastLen = Math.sqrt(eastX * eastX + eastY * eastY + eastZ * eastZ)
  const invEastLen = eastLen > PROJECTION_EPSILON ? 1 / eastLen : 1
  eastX *= invEastLen
  eastY *= invEastLen
  eastZ *= invEastLen

  const northX = eastY * center.z - eastZ * center.y
  const northY = eastZ * center.x - eastX * center.z
  const northZ = eastX * center.y - eastY * center.x

  return {
    northX,
    northY,
    northZ,
    eastX,
    eastY,
    eastZ,
  }
}

function makeEmptyLidar(): ConeHit[] {
  const lidar = new Array<ConeHit>(CONE_COUNT)
  for (let i = 0; i < CONE_COUNT; i++) {
    lidar[i] = {
      proximity: 0,
      bearing: 0,
      velocityX: 0,
      velocityY: 0,
    }
  }
  return lidar
}

function resetLidar(lidar: ConeHit[]): void {
  for (let i = 0; i < CONE_COUNT; i++) {
    const hit = lidar[i]
    if (hit == null) {
      lidar[i] = {
        proximity: 0,
        bearing: 0,
        velocityX: 0,
        velocityY: 0,
      }
      continue
    }
    hit.proximity = 0
    hit.bearing = 0
    hit.velocityX = 0
    hit.velocityY = 0
  }
  if (lidar.length !== CONE_COUNT) {
    lidar.length = CONE_COUNT
  }
}

function makeEmptyBullets(): BulletHit[] {
  const bullets = new Array<BulletHit>(BULLET_SLOTS)
  for (let i = 0; i < BULLET_SLOTS; i++) {
    bullets[i] = {
      proximity: 0,
      bearing: 0,
      velocityX: 0,
      velocityY: 0,
    }
  }
  return bullets
}

function resetBullets(bullets: BulletHit[]): void {
  for (let i = 0; i < BULLET_SLOTS; i++) {
    const hit = bullets[i]
    if (hit == null) {
      bullets[i] = {
        proximity: 0,
        bearing: 0,
        velocityX: 0,
        velocityY: 0,
      }
      continue
    }
    hit.proximity = 0
    hit.bearing = 0
    hit.velocityX = 0
    hit.velocityY = 0
  }
  if (bullets.length !== BULLET_SLOTS) {
    bullets.length = BULLET_SLOTS
  }
}

export function createObservationFrameBuffer(): ObservationFrame {
  return {
    shipAlive: false,
    ship: {
      velocityX: 0,
      velocityY: 0,
    },
    lidar: makeEmptyLidar(),
    bullets: makeEmptyBullets(),
  }
}

function findConeIndex(localX: number, localY: number): number {
  let angle = Math.atan2(localX, localY)
  if (angle < -Math.PI) angle += TWO_PI
  return Math.floor(((angle + Math.PI) / TWO_PI) * CONE_COUNT) % CONE_COUNT
}

/** Returns rock radius in unit-sphere angular radians for proximity math. */
function rockRadiusBySize(size: 0 | 1 | 2): number {
  return size === 2
    ? UNIT_ROCK_LARGE_RADIUS
    : size === 1
      ? UNIT_ROCK_MEDIUM_RADIUS
      : UNIT_ROCK_SMALL_RADIUS
}

function updateConeHit(
  lidar: ConeHit[],
  localX: number,
  localY: number,
  rockRadius: number,
  relVelRight: number,
  relVelForward: number
): void {
  // Orthographic distance on tangent plane
  const orthoDist = Math.sqrt(localX * localX + localY * localY)

  // Collision-adjusted proximity (all values in unit-sphere coordinates)
  const effectiveDist = Math.max(0, orthoDist - UNIT_SHIP_RADIUS - rockRadius)
  const proximity =
    effectiveDist <= BULLET_RANGE_ORTHO
      ? 1 - effectiveDist / BULLET_RANGE_ORTHO
      : -clamp(
          (effectiveDist - BULLET_RANGE_ORTHO) /
            (MAX_HEMISPHERE_ORTHO - BULLET_RANGE_ORTHO),
          0,
          1
        )

  if (proximity <= -1) return

  const coneIndex = findConeIndex(localX, localY)
  const current = lidar[coneIndex]
  if (current == null) return
  if (proximity <= current.proximity) return

  // Bearing: angle from nose in half-turns
  const bearing = Math.atan2(localX, localY) / Math.PI

  current.proximity = proximity
  current.bearing = clamp(bearing, -1, 1)
  current.velocityX = clamp(relVelRight / MAX_CLOSING_SPEED, -1, 1)
  current.velocityY = clamp(relVelForward / MAX_CLOSING_SPEED, -1, 1)
}

export interface RockPerceptionEntry {
  id: string
  localX: number
  localY: number
  inVisionRange: boolean
  radius: number
  /** Rock angular velocity components (world-space) */
  avx: number
  avy: number
  avz: number
}

export interface RockPerceptionPrecompute {
  rocks: RockPerceptionEntry[]
  /** Ship center used for projection */
  ship: SpatialPoint
  /** Rotated forward basis (bearing-adjusted) */
  forwardX: number
  forwardY: number
  forwardZ: number
  /** Rotated right basis (bearing-adjusted) */
  rightX: number
  rightY: number
  rightZ: number
}

export function buildRockPerceptionPrecompute(
  shipCenter: SpatialPoint,
  shipBearing: number,
  spatialQueries?: Pick<ManagedSpatialQueries, 'queryRocksNear'>
): RockPerceptionPrecompute {
  const queries = requireSpatialQueries(spatialQueries)
  const basis = buildLocalBasisFromCenter(shipCenter)
  const shipX = shipCenter.x
  const shipY = shipCenter.z
  const shipZ = shipCenter.y
  const northX = basis.northX
  const northY = basis.northZ
  const northZ = basis.northY
  const eastX = basis.eastX
  const eastY = basis.eastZ
  const eastZ = basis.eastY
  const sinBearing = Math.sin(shipBearing)
  const cosBearing = Math.cos(shipBearing)
  const forwardX = northX * cosBearing + eastX * sinBearing
  const forwardY = northY * cosBearing + eastY * sinBearing
  const forwardZ = northZ * cosBearing + eastZ * sinBearing
  const rightX = eastX * cosBearing - northX * sinBearing
  const rightY = eastY * cosBearing - northY * sinBearing
  const rightZ = eastZ * cosBearing - northZ * sinBearing
  const candidateRocks = queries.queryRocksNear(shipCenter, SOI_ARC_DISTANCE)
  const rockCount = candidateRocks.length
  const rocks = new Array<RockPerceptionEntry>(rockCount)

  for (let index = 0; index < rockCount; index++) {
    const entry = candidateRocks[index]!
    const point = entry.point
    const entity = entry.entity

    const rx = point.x
    const ry = point.z
    const rz = point.y

    const dot = shipX * rx + shipY * ry + shipZ * rz

    let localX = 0
    let localY = 0
    let inVisionRange = false

    if (dot >= SOI_DOT_THRESHOLD) {
      // Orthographic projection: drop the / dot
      localX = rx * rightX + ry * rightY + rz * rightZ
      localY = rx * forwardX + ry * forwardY + rz * forwardZ
      inVisionRange = true
    }

    // Remap angular velocity y↔z (engine y-up → projection z-up)
    const av = entity.angularVelocity
    rocks[index] = {
      id: entity.id,
      localX,
      localY,
      inVisionRange,
      radius: rockRadiusBySize(entity.size),
      avx: av.x,
      avy: av.z,
      avz: av.y,
    }
  }

  return {
    rocks,
    ship: shipCenter,
    forwardX,
    forwardY,
    forwardZ,
    rightX,
    rightY,
    rightZ,
  }
}

/**
 * Populate the ship section of the observation frame.
 * Returns the live ShipState or null if the ship is dead.
 */
function collectShipObservation(
  state: GameState,
  playerId: string,
  frame: ObservationFrame
): ShipState | null {
  const player = state.players.get(playerId)
  const ship =
    player?.shipId != null ? state.ships.get(player.shipId) : undefined

  if (ship == null || !ship.alive) {
    frame.shipAlive = false
    frame.ship.velocityX = 0
    frame.ship.velocityY = 0
    return null
  }

  frame.shipAlive = true
  return ship
}

/**
 * Project ship angular velocity onto tangent-plane basis and write to frame.
 * Accepts remapped AV (y↔z swapped to z-up projection space).
 */
function encodeShipVelocity(
  av: { x: number; y: number; z: number },
  forwardX: number,
  forwardY: number,
  forwardZ: number,
  rightX: number,
  rightY: number,
  rightZ: number,
  frame: ObservationFrame
): void {
  const vRight = av.x * rightX + av.y * rightY + av.z * rightZ
  const vForward = av.x * forwardX + av.y * forwardY + av.z * forwardZ
  frame.ship.velocityX = clamp(vRight / MAX_SPEED, -1, 1)
  frame.ship.velocityY = clamp(vForward / MAX_SPEED, -1, 1)
}

function scanRocks(
  rockPerception: RockPerceptionPrecompute,
  shipAV: { x: number; y: number; z: number },
  lidar: ConeHit[]
): void {
  const { forwardX, forwardY, forwardZ, rightX, rightY, rightZ } =
    rockPerception

  for (const rock of rockPerception.rocks) {
    if (!rock.inVisionRange) continue

    // Relative velocity: rock - ship, projected onto tangent plane
    const dvx = rock.avx - shipAV.x
    const dvy = rock.avy - shipAV.y
    const dvz = rock.avz - shipAV.z
    const relVelRight = dvx * rightX + dvy * rightY + dvz * rightZ
    const relVelForward = dvx * forwardX + dvy * forwardY + dvz * forwardZ

    updateConeHit(
      lidar,
      rock.localX,
      rock.localY,
      rock.radius,
      relVelRight,
      relVelForward
    )
  }
}

/** Hemisphere limit — rocks beyond π/2 radians from the ship are behind it. */
const MEMORY_ANGULAR_LIMIT = Math.PI / 2

/**
 * Fill empty cones with rocks the agent has previously observed.
 *
 * Step 1: Add all currently visible rock IDs to the memory set.
 * Step 2: Prune destroyed rocks and rocks past the hemisphere.
 * Step 3: For each surviving memory rock not currently in SOI,
 *         project it and fill empty cones with real data.
 */
function scanMemoryRocks(
  state: GameState,
  seenRocks: Set<string>,
  currentPerception: RockPerceptionPrecompute,
  shipAV: { x: number; y: number; z: number },
  lidar: ConeHit[]
): void {
  // Step 1: Add visible rocks to memory
  const visibleIds = new Set<string>()
  for (const rock of currentPerception.rocks) {
    if (rock.inVisionRange) {
      seenRocks.add(rock.id)
      visibleIds.add(rock.id)
    }
  }

  // Nothing in memory beyond visible rocks — early out
  if (seenRocks.size === visibleIds.size) return

  // Reuse precomputed basis from buildRockPerceptionPrecompute
  const {
    ship: shipCenter,
    forwardX,
    forwardY,
    forwardZ,
    rightX,
    rightY,
    rightZ,
  } = currentPerception
  const shipX = shipCenter.x
  const shipY = shipCenter.z
  const shipZ = shipCenter.y

  // Step 2 & 3: Prune and fill
  for (const rockId of seenRocks) {
    // Skip currently visible rocks (already filled by scanRocks)
    if (visibleIds.has(rockId)) continue

    // Check if rock still exists
    const rock: RockState | undefined = state.rocks.get(rockId)
    if (rock == null) {
      seenRocks.delete(rockId)
      continue
    }

    // Remap to local coordinate system (y-up → z-up for projection math)
    const rx = rock.x
    const ry = rock.z
    const rz = rock.y

    // Hemisphere check: dot > 0 means rock is on ship's side of the sphere
    const dot = shipX * rx + shipY * ry + shipZ * rz
    if (dot <= 0) {
      seenRocks.delete(rockId)
      continue
    }

    // Angular distance check (radians, unit-sphere coordinates)
    const angularDist = Math.acos(clamp(dot, -1, 1))
    if (angularDist > MEMORY_ANGULAR_LIMIT) {
      seenRocks.delete(rockId)
      continue
    }

    // Orthographic projection (no division by dot)
    const localX = rx * rightX + ry * rightY + rz * rightZ
    const localY = rx * forwardX + ry * forwardY + rz * forwardZ

    // Find which cone this rock falls in
    const slotIndex = findConeIndex(localX, localY)

    // Only fill empty slots
    const current = lidar[slotIndex]
    if (current == null || current.proximity > 0) continue

    // Compute relative velocity (remap rock AV y↔z to match projection space)
    const av = rock.angularVelocity
    const dvx = av.x - shipAV.x
    const dvy = av.z - shipAV.y
    const dvz = av.y - shipAV.z
    const relVelRight = dvx * rightX + dvy * rightY + dvz * rightZ
    const relVelForward = dvx * forwardX + dvy * forwardY + dvz * forwardZ

    const rockRadius = rockRadiusBySize(rock.size)

    // Orthographic distance on tangent plane
    const orthoDist = Math.sqrt(localX * localX + localY * localY)
    const effectiveDist = Math.max(0, orthoDist - UNIT_SHIP_RADIUS - rockRadius)
    const proximity =
      effectiveDist <= BULLET_RANGE_ORTHO
        ? 1 - effectiveDist / BULLET_RANGE_ORTHO
        : -clamp(
            (effectiveDist - BULLET_RANGE_ORTHO) /
              (MAX_HEMISPHERE_ORTHO - BULLET_RANGE_ORTHO),
            0,
            1
          )

    if (proximity <= -1) continue

    const bearing = Math.atan2(localX, localY) / Math.PI

    current.proximity = proximity
    current.bearing = clamp(bearing, -1, 1)
    current.velocityX = clamp(relVelRight / MAX_CLOSING_SPEED, -1, 1)
    current.velocityY = clamp(relVelForward / MAX_CLOSING_SPEED, -1, 1)
  }
}

function scanBullets(
  state: GameState,
  playerId: string,
  rockPerception: RockPerceptionPrecompute,
  shipAV: { x: number; y: number; z: number },
  bullets: BulletHit[]
): void {
  const player = state.players.get(playerId)
  if (player?.shipId == null) return
  const shipId = player.shipId

  const {
    ship: shipCenter,
    forwardX,
    forwardY,
    forwardZ,
    rightX,
    rightY,
    rightZ,
  } = rockPerception
  const shipX = shipCenter.x
  const shipY = shipCenter.z
  const shipZ = shipCenter.y

  // Collect own bullets and sort by firedAt ascending (oldest first)
  const ownBullets: {
    x: number
    y: number
    z: number
    avx: number
    avy: number
    avz: number
    firedAt: number
  }[] = []
  for (const bullet of state.bullets.values()) {
    if (bullet.ownerId !== shipId) continue
    ownBullets.push({
      x: bullet.x,
      y: bullet.z, // remap y↔z (engine y-up → projection z-up)
      z: bullet.y,
      avx: bullet.angularVelocity.x,
      avy: bullet.angularVelocity.z, // remap y↔z
      avz: bullet.angularVelocity.y,
      firedAt: bullet.firedAt ?? 0,
    })
  }
  ownBullets.sort((a, b) => a.firedAt - b.firedAt)

  const count = Math.min(ownBullets.length, BULLET_SLOTS)
  for (let i = 0; i < count; i++) {
    const b = ownBullets[i]!
    const slot = bullets[i]!

    // Dot product for hemisphere check
    const dot = shipX * b.x + shipY * b.y + shipZ * b.z
    if (dot <= 0) continue

    // Orthographic projection onto ship's tangent plane
    const localX = b.x * rightX + b.y * rightY + b.z * rightZ
    const localY = b.x * forwardX + b.y * forwardY + b.z * forwardZ

    // Orthographic distance on tangent plane
    const orthoDist = Math.sqrt(localX * localX + localY * localY)
    const effectiveDist = Math.max(
      0,
      orthoDist - UNIT_SHIP_RADIUS - UNIT_BULLET_RADIUS
    )
    const proximity =
      effectiveDist <= BULLET_RANGE_ORTHO
        ? 1 - effectiveDist / BULLET_RANGE_ORTHO
        : -clamp(
            (effectiveDist - BULLET_RANGE_ORTHO) /
              (MAX_HEMISPHERE_ORTHO - BULLET_RANGE_ORTHO),
            0,
            1
          )

    if (proximity <= -1) continue

    // Bearing: angle from nose in half-turns
    const bearing = Math.atan2(localX, localY) / Math.PI

    // Relative velocity: bullet - ship, projected onto tangent plane
    const dvx = b.avx - shipAV.x
    const dvy = b.avy - shipAV.y
    const dvz = b.avz - shipAV.z
    const relVelRight = dvx * rightX + dvy * rightY + dvz * rightZ
    const relVelForward = dvx * forwardX + dvy * forwardY + dvz * forwardZ

    slot.proximity = proximity
    slot.bearing = clamp(bearing, -1, 1)
    slot.velocityX = clamp(relVelRight / MAX_CLOSING_SPEED, -1, 1)
    slot.velocityY = clamp(relVelForward / MAX_CLOSING_SPEED, -1, 1)
  }
}

export function collectObservations(
  state: GameState,
  playerId: string,
  frameBuffer?: ObservationFrame,
  rockPerceptionBuffer?: RockPerceptionPrecompute,
  spatialQueries?: Pick<ManagedSpatialQueries, 'queryRocksNear'>,
  seenRocks?: Set<string>
): ObservationFrame {
  const frame = frameBuffer ?? createObservationFrameBuffer()
  if (frameBuffer != null) {
    resetLidar(frame.lidar)
    resetBullets(frame.bullets)
  }
  const ship = collectShipObservation(state, playerId, frame)
  if (ship == null) {
    return frame
  }

  const shipBearing = yawToBearing(ship.yaw)
  const rockPerception =
    rockPerceptionBuffer ??
    buildRockPerceptionPrecompute(ship, shipBearing, spatialQueries)

  const { forwardX, forwardY, forwardZ, rightX, rightY, rightZ } =
    rockPerception

  // Remap ship angular velocity y↔z (engine y-up → projection z-up)
  const rawAV = ship.angularVelocity
  const shipAV = { x: rawAV.x, y: rawAV.z, z: rawAV.y }

  // Encode ship velocity onto tangent plane
  encodeShipVelocity(
    shipAV,
    forwardX,
    forwardY,
    forwardZ,
    rightX,
    rightY,
    rightZ,
    frame
  )

  // Step 1: Fill cones from SOI rocks
  scanRocks(rockPerception, shipAV, frame.lidar)

  // Step 2: Manage memory + fill empty cones from remembered rocks
  if (seenRocks != null) {
    scanMemoryRocks(state, seenRocks, rockPerception, shipAV, frame.lidar)
  }

  // Step 3: Fill bullet slots (oldest first)
  scanBullets(state, playerId, rockPerception, shipAV, frame.bullets)

  return frame
}
