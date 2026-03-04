import type {
  GameState,
  ManagedSpatialQueries,
  RockState,
  ShipState,
  SpatialPoint,
} from '@heygrady/hexagonoids-engine'
import {
  elapsed,
  FIRE_COOLDOWN,
  MAX_SPEED,
  PLAYER_STARTING_LIVES,
  RADIUS,
  TURN_RATE,
} from '@heygrady/hexagonoids-engine'
import { yawToBearing } from '../utils/sphericalBearing.js'
import { MAX_CLOSING_SPEED, SOI_ARC_DISTANCE } from './constants.js'
import { CONE_COUNT } from './encodingPresets.js'
import type { ConeHit, ObservationFrame } from './observationTypes.js'

const TWO_PI = Math.PI * 2
const MAX_VISION_ARC = SOI_ARC_DISTANCE
const CLOSING_EPSILON = 1e-9
const PROJECTION_EPSILON = 1e-6
const MAX_BEARING_DRIFT = Math.PI
// Precomputed dot-product threshold for SOI culling.
// cos(maxVisionAngle) — rocks with dot product below this are outside SOI.
const MAX_VISION_ANGLE = MAX_VISION_ARC / RADIUS
const SOI_DOT_THRESHOLD = Math.cos(MAX_VISION_ANGLE)

const CONE8_STEP = TWO_PI / CONE_COUNT
const CONE8_HALF_STEP = CONE8_STEP * 0.5
const CONE8_DIRECTIONS = new Array<{ x: number; y: number }>(CONE_COUNT)

for (let i = 0; i < CONE_COUNT; i++) {
  const angle = (i / CONE_COUNT) * TWO_PI - Math.PI
  CONE8_DIRECTIONS[i] = {
    x: Math.sin(angle),
    y: Math.cos(angle),
  }
}

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
  const refX = Math.abs(center.y) > 0.99 ? 0 : 0
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

function headingVelocityComponents(
  ship: ShipState
): [forward: number, lateral: number, speed: number] {
  const angularVelocity = ship.angularVelocity
  const speed = Math.sqrt(
    angularVelocity.x * angularVelocity.x +
      angularVelocity.y * angularVelocity.y +
      angularVelocity.z * angularVelocity.z
  )
  if (speed < 0.00001) {
    return [1, 0, speed]
  }

  // Derive basis from quaternion orientation to avoid pole singularities.
  const { x, y, z, w } = ship.orientation
  const x2 = x + x
  const y2 = y + y
  const z2 = z + z
  const xx = x * x2
  const xy = x * y2
  const xz = x * z2
  const yy = y * y2
  const yz = y * z2
  const zz = z * z2
  const wx = w * x2
  const wy = w * y2
  const wz = w * z2

  // Rotated local up (0,1,0).
  const upX = xy - wz
  const upY = 1 - xx - zz
  const upZ = yz + wx

  // Rotated local forward (0,0,1) is yaw=0 heading.
  const forwardX = xz + wy
  const forwardY = yz - wx
  const forwardZ = 1 - xx - yy

  const sinYaw = Math.sin(ship.yaw)
  const cosYaw = Math.cos(ship.yaw)
  const crossX = upY * forwardZ - upZ * forwardY
  const crossY = upZ * forwardX - upX * forwardZ
  const crossZ = upX * forwardY - upY * forwardX
  const dot = upX * forwardX + upY * forwardY + upZ * forwardZ
  const oneMinusCos = 1 - cosYaw

  const headingX = forwardX * cosYaw + crossX * sinYaw + upX * dot * oneMinusCos
  const headingY = forwardY * cosYaw + crossY * sinYaw + upY * dot * oneMinusCos
  const headingZ = forwardZ * cosYaw + crossZ * sinYaw + upZ * dot * oneMinusCos

  // Thrust axis is up × heading.
  const thrustX = upY * headingZ - upZ * headingY
  const thrustY = upZ * headingX - upX * headingZ
  const thrustZ = upX * headingY - upY * headingX
  const axisLen = Math.sqrt(
    thrustX * thrustX + thrustY * thrustY + thrustZ * thrustZ
  )
  if (axisLen < 0.00001) {
    return [1, 0, 0]
  }
  const invAxisLen = 1 / axisLen

  const forward =
    (angularVelocity.x * thrustX * invAxisLen +
      angularVelocity.y * thrustY * invAxisLen +
      angularVelocity.z * thrustZ * invAxisLen) /
    speed
  const lateral =
    (angularVelocity.x * headingX +
      angularVelocity.y * headingY +
      angularVelocity.z * headingZ) /
    speed
  return [clamp(forward, -1, 1), clamp(lateral, -1, 1), speed]
}

function makeEmptyLidar(): ConeHit[] {
  const lidar = new Array<ConeHit>(CONE_COUNT)
  for (let i = 0; i < CONE_COUNT; i++) {
    lidar[i] = {
      distanceNorm: 1,
      closingSpeed: 0,
      bearingOffsetNorm: 0,
      tangentialSpeed: 0,
    }
  }
  return lidar
}

function resetLidar(lidar: ConeHit[]): void {
  for (let i = 0; i < CONE_COUNT; i++) {
    const hit = lidar[i]
    if (hit == null) {
      lidar[i] = {
        distanceNorm: 1,
        closingSpeed: 0,
        bearingOffsetNorm: 0,
        tangentialSpeed: 0,
      }
      continue
    }
    hit.distanceNorm = 1
    hit.closingSpeed = 0
    hit.bearingOffsetNorm = 0
    hit.tangentialSpeed = 0
  }
  if (lidar.length !== CONE_COUNT) {
    lidar.length = CONE_COUNT
  }
}

export function createObservationFrameBuffer(): ObservationFrame {
  return {
    shipAlive: false,
    ship: {
      speedNorm: 0,
      headingForwardDrift: 0,
      headingLateralDrift: 0,
      angularVelocityNorm: 0,
    },
    temporal: {
      cooldownNorm: 0,
      livesNorm: 0,
    },
    lidar: makeEmptyLidar(),
  }
}

export type PreviousRockProjectionMap = Map<string, [number, number]>

function findConeIndex(localX: number, localY: number): number {
  let angle = Math.atan2(localX, localY)
  if (angle < -Math.PI) angle += TWO_PI
  return Math.floor(((angle + Math.PI) / TWO_PI) * CONE_COUNT) % CONE_COUNT
}

function updateConeHit(
  lidar: ConeHit[],
  rockId: string,
  localX: number,
  localY: number,
  arcDist: number,
  closingSpeed: number,
  prevProjections: PreviousRockProjectionMap | undefined,
  invDtSeconds: number
): void {
  if (arcDist > MAX_VISION_ARC) return

  const coneIndex = findConeIndex(localX, localY)
  const distanceNorm = clamp(arcDist / MAX_VISION_ARC, 0, 1)

  const current = lidar[coneIndex]
  if (current == null) return
  if (distanceNorm >= current.distanceNorm) return

  const closingSpeedNorm = clamp(closingSpeed / MAX_CLOSING_SPEED, -1, 1)

  // Lateral offset: perpendicular displacement within the cone, normalized to [-1, 1]
  const dir = CONE8_DIRECTIONS[coneIndex]!
  const depth = localX * dir.x + localY * dir.y
  const side = localX * dir.y - localY * dir.x
  const coneHalfWidth = Math.max(
    PROJECTION_EPSILON,
    Math.abs(depth) * Math.tan(CONE8_HALF_STEP)
  )
  const lateralOffset = clamp(side / coneHalfWidth, -1, 1)

  // Radial velocity (closing speed already computed)
  current.distanceNorm = distanceNorm
  current.closingSpeed = closingSpeedNorm
  current.bearingOffsetNorm = lateralOffset

  // Tangential velocity from frame-over-frame projections
  let tangential = 0
  if (prevProjections != null && invDtSeconds >= CLOSING_EPSILON) {
    const prev = prevProjections.get(rockId)
    if (prev != null) {
      const velocityX = (localX - prev[0]) * invDtSeconds
      const velocityY = (localY - prev[1]) * invDtSeconds
      const safeDepth = Math.max(PROJECTION_EPSILON, Math.abs(depth))
      tangential = clamp(
        (velocityX * dir.y - velocityY * dir.x) / safeDepth / MAX_BEARING_DRIFT,
        -1,
        1
      )
    }
  }
  current.tangentialSpeed = tangential
}

export interface RockPerceptionEntry {
  id: string
  distance: number
  localX: number
  localY: number
  inVisionRange: boolean
  radius: number
  sizeNorm: number
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

function rockRadiusBySize(size: 0 | 1 | 2): number {
  return size === 2 ? 0.26 : size === 1 ? 0.13 : 0.07
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
  const candidateRocks = queries.queryRocksNear(shipCenter, MAX_VISION_ARC)
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

    const distance = RADIUS * Math.acos(clamp(dot, -1, 1))
    let localX = 0
    let localY = 0
    let inVisionRange = false

    if (dot >= SOI_DOT_THRESHOLD && distance <= MAX_VISION_ARC) {
      if (dot > PROJECTION_EPSILON) {
        localX = (rx * rightX + ry * rightY + rz * rightZ) / dot
        localY = (rx * forwardX + ry * forwardY + rz * forwardZ) / dot
        inVisionRange = true
      }
    }

    rocks[index] = {
      id: entity.id,
      distance,
      localX,
      localY,
      inVisionRange,
      radius: rockRadiusBySize(entity.size),
      sizeNorm: entity.size / 2,
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
 * Populate the ship and temporal sections of the observation frame.
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
    frame.ship.speedNorm = 0
    frame.ship.headingForwardDrift = 0
    frame.ship.headingLateralDrift = 0
    frame.ship.angularVelocityNorm = 0
    frame.temporal.cooldownNorm = 0
    frame.temporal.livesNorm = clamp(
      (player?.lives ?? 0) / PLAYER_STARTING_LIVES,
      0,
      1
    )
    return null
  }

  const [forward, lateral, shipSpeed] = headingVelocityComponents(ship)
  frame.shipAlive = true
  frame.ship.speedNorm = clamp(shipSpeed / MAX_SPEED, 0, 1)
  frame.ship.headingForwardDrift = forward
  frame.ship.headingLateralDrift = lateral
  frame.ship.angularVelocityNorm = clamp(shipSpeed / TURN_RATE, 0, 1)
  frame.temporal.cooldownNorm = clamp(
    elapsed(state, ship.firedAt) / FIRE_COOLDOWN,
    0,
    1
  )
  frame.temporal.livesNorm = clamp(
    (player?.lives ?? 0) / PLAYER_STARTING_LIVES,
    0,
    1
  )

  return ship
}

function closingSpeedFromPrev(
  prevDistances: Map<string, number>,
  key: string,
  currentDistance: number,
  invDtSeconds: number
): number {
  const prev = prevDistances.get(key)
  if (prev == null || invDtSeconds < CLOSING_EPSILON) return 0
  return (prev - currentDistance) * invDtSeconds
}

function scanRocks(
  rockPerception: RockPerceptionPrecompute,
  prevProjections: PreviousRockProjectionMap | undefined,
  prevDistances: Map<string, number>,
  invDtSeconds: number,
  lidar: ConeHit[]
): void {
  for (const rock of rockPerception.rocks) {
    if (!rock.inVisionRange) continue
    const closing = closingSpeedFromPrev(
      prevDistances,
      rock.id,
      rock.distance,
      invDtSeconds
    )
    updateConeHit(
      lidar,
      rock.id,
      rock.localX,
      rock.localY,
      rock.distance,
      closing,
      prevProjections,
      invDtSeconds
    )
  }
}

/** Hemisphere limit — rocks beyond π/2 radians from the ship are behind it. */
const MEMORY_VISION_ARC = (Math.PI / 2) * RADIUS

/**
 * Fill empty cones with rocks the agent has previously observed.
 *
 * Step 1: Add all currently visible rock IDs to the memory set.
 * Step 2: Prune destroyed rocks and rocks past the hemisphere.
 * Step 3: For each surviving memory rock not currently in SOI,
 *         project it and fill empty cones with real data.
 *
 * Updates prevDistances for memory rocks so closing speed works frame-over-frame.
 */
function scanMemoryRocks(
  state: GameState,
  seenRocks: Set<string>,
  currentPerception: RockPerceptionPrecompute,
  prevDistances: Map<string, number>,
  invDtSeconds: number,
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

    // Compute distance and local projection
    const distance = RADIUS * Math.acos(clamp(dot, -1, 1))
    if (distance > MEMORY_VISION_ARC) {
      seenRocks.delete(rockId)
      continue
    }

    const depth = dot
    if (depth <= PROJECTION_EPSILON) continue

    const localX = (rx * rightX + ry * rightY + rz * rightZ) / depth
    const localY = (rx * forwardX + ry * forwardY + rz * forwardZ) / depth

    // Find which cone this rock falls in
    const slotIndex = findConeIndex(localX, localY)

    // Only fill empty slots
    const current = lidar[slotIndex]
    if (current == null || current.distanceNorm < 1) continue

    // Compute closing speed from prevDistances
    const closing = closingSpeedFromPrev(
      prevDistances,
      rockId,
      distance,
      invDtSeconds
    )

    // Update prevDistances so next frame's closing speed is accurate
    prevDistances.set(rockId, distance)

    // Normalize distance by hemisphere range
    const distanceNorm = clamp(distance / MEMORY_VISION_ARC, 0, 1)
    const closingSpeedNorm = clamp(closing / MAX_CLOSING_SPEED, -1, 1)

    const dir = CONE8_DIRECTIONS[slotIndex]!
    const coneDepth = localX * dir.x + localY * dir.y
    const side = localX * dir.y - localY * dir.x
    const coneHalfWidth = Math.max(
      PROJECTION_EPSILON,
      Math.abs(coneDepth) * Math.tan(CONE8_HALF_STEP)
    )

    current.distanceNorm = distanceNorm
    current.closingSpeed = closingSpeedNorm
    current.bearingOffsetNorm = clamp(side / coneHalfWidth, -1, 1)
    current.tangentialSpeed = 0
  }
}

export function collectObservations(
  state: GameState,
  playerId: string,
  prevProjections: PreviousRockProjectionMap | undefined,
  prevDistances: Map<string, number>,
  dtMs: number,
  frameBuffer?: ObservationFrame,
  rockPerceptionBuffer?: RockPerceptionPrecompute,
  spatialQueries?: Pick<ManagedSpatialQueries, 'queryRocksNear'>,
  seenRocks?: Set<string>
): ObservationFrame {
  const frame = frameBuffer ?? createObservationFrameBuffer()
  if (frameBuffer != null) {
    resetLidar(frame.lidar)
  }
  const ship = collectShipObservation(state, playerId, frame)
  if (ship == null) {
    return frame
  }

  const shipBearing = yawToBearing(ship.yaw)
  const rockPerception =
    rockPerceptionBuffer ??
    buildRockPerceptionPrecompute(ship, shipBearing, spatialQueries)
  const invDtSeconds = dtMs > 0 ? 1000 / dtMs : 0

  // Step 1: Fill cones from SOI rocks
  scanRocks(
    rockPerception,
    prevProjections,
    prevDistances,
    invDtSeconds,
    frame.lidar
  )

  // Step 2: Manage memory + fill empty cones from remembered rocks
  if (seenRocks != null) {
    scanMemoryRocks(
      state,
      seenRocks,
      rockPerception,
      prevDistances,
      invDtSeconds,
      frame.lidar
    )
  }

  return frame
}
