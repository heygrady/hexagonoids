import type {
  GameState,
  ManagedSpatialQueries,
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
import {
  DEFAULT_ENCODING_PRESET,
  type EncodingPreset,
  getLidarRayCount,
  LIDAR_RAY_COUNT,
} from './encodingPresets.js'
import type {
  LidarHit,
  ObservationFrame,
  ShipObservation,
  TemporalObservation,
} from './observationTypes.js'

export { LIDAR_RAY_COUNT } from './encodingPresets.js'

const TWO_PI = Math.PI * 2
const MAX_VISION_ARC = SOI_ARC_DISTANCE
const CLOSING_EPSILON = 1e-9
const PROJECTION_EPSILON = 1e-6
const MAX_BEARING_DRIFT = Math.PI
const RAY_STEP = TWO_PI / LIDAR_RAY_COUNT
const TAN_HALF_RAY_STEP = Math.tan(RAY_STEP * 0.5)
// Precomputed dot-product threshold for SOI culling.
// cos(maxVisionAngle) — rocks with dot product below this are outside SOI.
const MAX_VISION_ANGLE = MAX_VISION_ARC / RADIUS
const SOI_DOT_THRESHOLD = Math.cos(MAX_VISION_ANGLE)
const RAY_DIRECTIONS = new Array<{ x: number; y: number }>(LIDAR_RAY_COUNT)

for (let i = 0; i < LIDAR_RAY_COUNT; i++) {
  const angle = (i / LIDAR_RAY_COUNT) * TWO_PI - Math.PI
  RAY_DIRECTIONS[i] = {
    x: Math.sin(angle),
    y: Math.cos(angle),
  }
}

const CONE8_COUNT = 8
const CONE8_STEP = TWO_PI / CONE8_COUNT
const CONE8_HALF_STEP = CONE8_STEP * 0.5
const CONE8_DIRECTIONS = new Array<{ x: number; y: number }>(CONE8_COUNT)

for (let i = 0; i < CONE8_COUNT; i++) {
  const angle = (i / CONE8_COUNT) * TWO_PI - Math.PI
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
): [forward: number, lateral: number] {
  const angularVelocity = ship.angularVelocity
  const speed = Math.sqrt(
    angularVelocity.x * angularVelocity.x +
      angularVelocity.y * angularVelocity.y +
      angularVelocity.z * angularVelocity.z
  )
  if (speed < 0.00001) {
    return [1, 0]
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
    return [1, 0]
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
  return [clamp(forward, -1, 1), clamp(lateral, -1, 1)]
}

function makeEmptyLidar(rayCount: number = LIDAR_RAY_COUNT): LidarHit[] {
  const lidar = new Array<LidarHit>(rayCount)
  for (let i = 0; i < rayCount; i++) {
    lidar[i] = {
      distanceNorm: 1,
      closingSpeed: 0,
      rockSizeNorm: 0,
      bearingOffsetNorm: 0,
      centerWeight: 0,
      bearingDriftNorm: 0,
      tangentialSpeed: 0,
    }
  }
  return lidar
}

function resetLidar(
  lidar: LidarHit[],
  rayCount: number = LIDAR_RAY_COUNT
): void {
  for (let i = 0; i < rayCount; i++) {
    const hit = lidar[i]
    if (hit == null) {
      lidar[i] = {
        distanceNorm: 1,
        closingSpeed: 0,
        rockSizeNorm: 0,
        bearingOffsetNorm: 0,
        centerWeight: 0,
        bearingDriftNorm: 0,
        tangentialSpeed: 0,
      }
      continue
    }
    hit.distanceNorm = 1
    hit.closingSpeed = 0
    hit.rockSizeNorm = 0
    hit.bearingOffsetNorm = 0
    hit.centerWeight = 0
    hit.bearingDriftNorm = 0
    hit.tangentialSpeed = 0
  }
  if (lidar.length !== rayCount) {
    lidar.length = rayCount
  }
}

export function createObservationFrameBuffer(
  encodingPreset: EncodingPreset = DEFAULT_ENCODING_PRESET
): ObservationFrame {
  const rayCount = getLidarRayCount(encodingPreset)
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
    lidar: makeEmptyLidar(rayCount),
  }
}

function rayDirectionAt(index: number): { x: number; y: number } {
  return RAY_DIRECTIONS[index] ?? RAY_DIRECTIONS[0]!
}

function findBestRayIndex(localX: number, localY: number): number {
  let bestIndex = 0
  let bestProjection = -Infinity
  for (let i = 0; i < LIDAR_RAY_COUNT; i++) {
    const dir = rayDirectionAt(i)
    const projection = localX * dir.x + localY * dir.y
    if (projection > bestProjection) {
      bestProjection = projection
      bestIndex = i
    }
  }
  return bestIndex
}

export type PreviousRockProjectionMap = Map<string, [number, number]>

function updateRayHit(
  lidar: LidarHit[],
  rockId: string,
  localX: number,
  localY: number,
  arcDist: number,
  entityRadius: number,
  closingSpeed: number,
  rockSizeNorm: number,
  prevProjections: PreviousRockProjectionMap | undefined,
  invDtSeconds: number,
  includeBearingDrift: boolean,
  includeCenterWeight: boolean
): void {
  if (arcDist > MAX_VISION_ARC) return

  const centerRayIndex = findBestRayIndex(localX, localY)
  const distanceNorm = clamp(arcDist / MAX_VISION_ARC, 0, 1)
  const closingSpeedNorm = clamp(closingSpeed / MAX_CLOSING_SPEED, -1, 1)
  const radiusArc = clamp(entityRadius / RADIUS, 0.001, 0.35)
  const entityTan = Math.tan(radiusArc)
  let velocityX = 0
  let velocityY = 0
  let hasPrevProjection = false

  if (
    includeBearingDrift &&
    prevProjections != null &&
    invDtSeconds >= CLOSING_EPSILON
  ) {
    const prev = prevProjections.get(rockId)
    if (prev != null) {
      velocityX = (localX - prev[0]) * invDtSeconds
      velocityY = (localY - prev[1]) * invDtSeconds
      hasPrevProjection = true
    }
  }

  for (let offset = -2; offset <= 2; offset++) {
    const idx = (centerRayIndex + offset + LIDAR_RAY_COUNT) % LIDAR_RAY_COUNT
    const dir = rayDirectionAt(idx)
    const depth = localX * dir.x + localY * dir.y
    if (depth <= PROJECTION_EPSILON) continue
    const side = localX * dir.y - localY * dir.x
    const rayHalfWidth = Math.max(PROJECTION_EPSILON, depth * TAN_HALF_RAY_STEP)
    const entityHalfWidth = Math.max(rayHalfWidth, depth * entityTan)
    const distanceToRay = Math.abs(side)
    if (distanceToRay > entityHalfWidth) continue

    const current = lidar[idx]
    if (current == null) continue
    if (distanceNorm >= current.distanceNorm) continue

    current.distanceNorm = distanceNorm
    current.closingSpeed = closingSpeedNorm
    current.rockSizeNorm = rockSizeNorm
    current.bearingOffsetNorm = clamp(side / rayHalfWidth, -1, 1)
    if (includeCenterWeight) {
      current.centerWeight = clamp(1 - distanceToRay / entityHalfWidth, 0, 1)
    }
    current.bearingDriftNorm = hasPrevProjection
      ? clamp(
          (velocityX * dir.y - velocityY * dir.x) /
            Math.max(PROJECTION_EPSILON, depth) /
            MAX_BEARING_DRIFT,
          -1,
          1
        )
      : 0
  }
}

function findConeIndex(localX: number, localY: number): number {
  let angle = Math.atan2(localX, localY)
  if (angle < -Math.PI) angle += TWO_PI
  return Math.floor(((angle + Math.PI) / TWO_PI) * CONE8_COUNT) % CONE8_COUNT
}

function updateConeHit(
  lidar: LidarHit[],
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
  // Ship XYZ on unit sphere for dot-product culling
  // Spatial index points are y-up; the local projection math in this module
  // uses a z-up basis, so remap the components once here.
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

  let index = 0

  const processRock = (rock: {
    point: SpatialPoint
    size: 0 | 1 | 2
    id: string
  }) => {
    const rx = rock.point.x
    const ry = rock.point.z
    const rz = rock.point.y

    // Dot product = cos(angle) between ship and rock on unit sphere.
    // Higher dot = closer. Skip expensive haversine for distant rocks.
    const dot = shipX * rx + shipY * ry + shipZ * rz

    let distance = 0
    let localX = 0
    let localY = 0
    let inVisionRange = false

    if (dot >= SOI_DOT_THRESHOLD) {
      distance = RADIUS * Math.acos(clamp(dot, -1, 1))

      if (distance <= MAX_VISION_ARC) {
        const depth = dot
        if (depth > PROJECTION_EPSILON) {
          localX = (rx * rightX + ry * rightY + rz * rightZ) / depth
          localY = (rx * forwardX + ry * forwardY + rz * forwardZ) / depth
          inVisionRange = true
        }
      }
    } else {
      // Rock is far outside SOI — use arc-cosine of dot for approximate distance
      distance = RADIUS * Math.acos(clamp(dot, -1, 1))
    }

    rocks[index] = {
      id: rock.id,
      distance,
      localX,
      localY,
      inVisionRange,
      radius: rockRadiusBySize(rock.size),
      sizeNorm: rock.size / 2,
    }
    index += 1
  }

  for (const entry of candidateRocks) {
    processRock({
      id: entry.entity.id,
      size: entry.entity.size,
      point: entry.point,
    })
  }

  return { rocks }
}

function collectShipObservation(
  state: GameState,
  playerId: string,
  frame: ObservationFrame
): {
  alive: boolean
  x: number
  y: number
  z: number
  shipBearing: number
  ship: ShipObservation
  temporal: TemporalObservation
} {
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
    return {
      alive: false,
      x: 0,
      y: 1,
      z: 0,
      shipBearing: 0,
      ship: frame.ship,
      temporal: frame.temporal,
    }
  }

  const [forward, lateral] = headingVelocityComponents(ship)
  const shipSpeed = ship.angularVelocity.length()
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

  return {
    alive: true,
    x: ship.x ?? 0,
    y: ship.y ?? 1,
    z: ship.z ?? 0,
    shipBearing: yawToBearing(ship.yaw),
    ship: frame.ship,
    temporal: frame.temporal,
  }
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
  lidar: LidarHit[],
  includeBearingDrift: boolean,
  includeCenterWeight: boolean,
  useCones: boolean
): void {
  for (const rock of rockPerception.rocks) {
    if (!rock.inVisionRange) continue
    const closing = closingSpeedFromPrev(
      prevDistances,
      rock.id,
      rock.distance,
      invDtSeconds
    )
    if (useCones) {
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
    } else {
      updateRayHit(
        lidar,
        rock.id,
        rock.localX,
        rock.localY,
        rock.distance,
        rock.radius,
        closing,
        rock.sizeNorm,
        prevProjections,
        invDtSeconds,
        includeBearingDrift,
        includeCenterWeight
      )
    }
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
  encodingPreset: EncodingPreset = DEFAULT_ENCODING_PRESET,
  spatialQueries?: Pick<ManagedSpatialQueries, 'queryRocksNear'>
): ObservationFrame {
  const rayCount = getLidarRayCount(encodingPreset)
  const frame = frameBuffer ?? createObservationFrameBuffer(encodingPreset)
  if (frameBuffer != null) {
    resetLidar(frame.lidar, rayCount)
  }
  const ship = collectShipObservation(state, playerId, frame)
  if (!ship.alive) {
    return frame
  }

  const rockPerception =
    rockPerceptionBuffer ??
    buildRockPerceptionPrecompute(
      {
        x: ship.x,
        y: ship.y,
        z: ship.z,
      },
      ship.shipBearing,
      spatialQueries
    )
  const invDtSeconds = dtMs > 0 ? 1000 / dtMs : 0
  const useCones = encodingPreset === 'cone8'
  const includeBearingDrift = encodingPreset !== 'four' && !useCones
  const includeCenterWeight = encodingPreset === 'six'

  scanRocks(
    rockPerception,
    prevProjections,
    prevDistances,
    invDtSeconds,
    frame.lidar,
    includeBearingDrift,
    includeCenterWeight,
    useCones
  )

  return frame
}
