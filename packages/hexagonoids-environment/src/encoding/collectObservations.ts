import type { GameState, ShipState } from '@heygrady/hexagonoids-engine'
import {
  elapsed,
  FIRE_COOLDOWN,
  MAX_SPEED,
  PLAYER_STARTING_LIVES,
  RADIUS,
  TURN_RATE,
} from '@heygrady/hexagonoids-engine'
import QuickLRU from 'quick-lru'

import { yawToBearing } from '../utils/sphericalBearing.js'
import { MAX_CLOSING_SPEED, SOI_ARC_DISTANCE } from './constants.js'
import type {
  LidarHit,
  ObservationFrame,
  ShipObservation,
  TemporalObservation,
} from './observationTypes.js'

export const LIDAR_RAY_COUNT = 32
const TWO_PI = Math.PI * 2
const MAX_VISION_ARC = SOI_ARC_DISTANCE
const DEG_TO_RAD = Math.PI / 180
const CLOSING_EPSILON = 1e-9
const RAY_STEP = TWO_PI / LIDAR_RAY_COUNT
const ROCK_KEY_CACHE = new QuickLRU<string, string>({ maxSize: 8192 })
const BULLET_KEY_CACHE = new QuickLRU<string, string>({ maxSize: 8192 })
const RAY_ANGLES = new Array<number>(LIDAR_RAY_COUNT)

for (let i = 0; i < LIDAR_RAY_COUNT; i++) {
  RAY_ANGLES[i] = (i / LIDAR_RAY_COUNT) * TWO_PI - Math.PI
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function wrapAngle(value: number): number {
  let a = value
  while (a > Math.PI) a -= TWO_PI
  while (a < -Math.PI) a += TWO_PI
  return a
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

function makeEmptyLidar(): LidarHit[] {
  const lidar = new Array<LidarHit>(LIDAR_RAY_COUNT)
  for (let i = 0; i < LIDAR_RAY_COUNT; i++) {
    lidar[i] = {
      distanceNorm: 1,
      closingSpeed: 0,
      isRock: 0,
      isBullet: 0,
    }
  }
  return lidar
}

function resetLidar(lidar: LidarHit[]): void {
  for (let i = 0; i < LIDAR_RAY_COUNT; i++) {
    const hit = lidar[i]
    if (hit == null) {
      lidar[i] = {
        distanceNorm: 1,
        closingSpeed: 0,
        isRock: 0,
        isBullet: 0,
      }
      continue
    }
    hit.distanceNorm = 1
    hit.closingSpeed = 0
    hit.isRock = 0
    hit.isBullet = 0
  }
  if (lidar.length !== LIDAR_RAY_COUNT) {
    lidar.length = LIDAR_RAY_COUNT
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

function rayIndexFromRelativeBearing(relative: number): number {
  const normalized = (relative + Math.PI) / TWO_PI
  return Math.floor(normalized * LIDAR_RAY_COUNT) % LIDAR_RAY_COUNT
}

function updateRayHit(
  lidar: LidarHit[],
  relBearing: number,
  arcDist: number,
  entityRadius: number,
  closingSpeed: number,
  isRock: boolean
): void {
  if (arcDist > MAX_VISION_ARC) return

  const centerRayIndex = rayIndexFromRelativeBearing(relBearing)
  const centerRayAngle = RAY_ANGLES[centerRayIndex] ?? 0
  const baseDelta = wrapAngle(relBearing - centerRayAngle)
  const distanceNorm = clamp(arcDist / MAX_VISION_ARC, 0, 1)
  const closingSpeedNorm = clamp(closingSpeed / MAX_CLOSING_SPEED, -1, 1)

  // Approximate angular width of entity from ship center.
  const radiusArc = clamp(entityRadius / RADIUS, 0.001, 0.35)

  // Update neighboring rays if entity spans multiple directions.
  for (let offset = -2; offset <= 2; offset++) {
    const delta = Math.abs(baseDelta - offset * RAY_STEP)
    if (delta > radiusArc) continue

    const idx = (centerRayIndex + offset + LIDAR_RAY_COUNT) % LIDAR_RAY_COUNT

    const current = lidar[idx]
    if (current == null) continue
    if (distanceNorm >= current.distanceNorm) continue

    current.distanceNorm = distanceNorm
    current.closingSpeed = closingSpeedNorm
    current.isRock = isRock ? 1 : 0
    current.isBullet = isRock ? 0 : 1
  }
}

function prevDistanceKey(entityType: 'rock' | 'bullet', id: string): string {
  if (entityType === 'rock') {
    const cached = ROCK_KEY_CACHE.get(id)
    if (cached != null) return cached
    const key = `rock:${id}`
    ROCK_KEY_CACHE.set(id, key)
    return key
  }

  const cached = BULLET_KEY_CACHE.get(id)
  if (cached != null) return cached
  const key = `bullet:${id}`
  BULLET_KEY_CACHE.set(id, key)
  return key
}

interface ShipGeoContext {
  latDeg: number
  lngDeg: number
  latRad: number
  sinLat: number
  cosLat: number
  shipBearing: number
  maxVisionAngle: number
  maxLngDelta: number
}

export interface RockPerceptionEntry {
  id: string
  distance: number
  relativeBearing: number
  inVisionRange: boolean
  radius: number
}

export interface RockPerceptionPrecompute {
  shipLatRad: number
  shipLngRad: number
  shipSinLat: number
  shipCosLat: number
  nearestCosPhi: number
  nearestSinPhi: number
  nearestDLambda: number
  nearestRelativeBearing: number
  hasNearest: boolean
  centroidX: number
  centroidY: number
  centroidZ: number
  rocks: RockPerceptionEntry[]
}

function rockRadiusBySize(size: 0 | 1 | 2): number {
  return size === 2 ? 0.26 : size === 1 ? 0.13 : 0.07
}

function createShipGeoContext(
  latDeg: number,
  lngDeg: number,
  shipBearing: number
): ShipGeoContext {
  const latRad = latDeg * DEG_TO_RAD
  const maxVisionAngle = MAX_VISION_ARC / RADIUS
  const cosLatSafe = Math.max(Math.abs(Math.cos(latRad)), 0.12)
  const maxLngDelta = Math.min(Math.PI, maxVisionAngle / cosLatSafe + 0.05)
  return {
    latDeg,
    lngDeg,
    latRad,
    sinLat: Math.sin(latRad),
    cosLat: Math.cos(latRad),
    shipBearing,
    maxVisionAngle,
    maxLngDelta,
  }
}

export function buildRockPerceptionPrecompute(
  state: GameState,
  shipLatDeg: number,
  shipLngDeg: number,
  shipBearing: number
): RockPerceptionPrecompute {
  const shipLatRad = shipLatDeg * DEG_TO_RAD
  const shipLngRad = shipLngDeg * DEG_TO_RAD
  const shipSinLat = Math.sin(shipLatRad)
  const shipCosLat = Math.cos(shipLatRad)
  const rocks = new Array<RockPerceptionEntry>(state.rocks.size)

  let nearestDistance = Number.POSITIVE_INFINITY
  let nearestCosPhi = 0
  let nearestSinPhi = 0
  let nearestDLambda = 0
  let nearestRelativeBearing = 0
  let hasNearest = false
  let centroidX = 0
  let centroidY = 0
  let centroidZ = 0
  let index = 0

  for (const rock of state.rocks.values()) {
    const phi = rock.lat * DEG_TO_RAD
    const lambda = rock.lng * DEG_TO_RAD
    const sinPhi = Math.sin(phi)
    const cosPhi = Math.cos(phi)
    centroidX += cosPhi * Math.cos(lambda)
    centroidY += cosPhi * Math.sin(lambda)
    centroidZ += sinPhi

    const dLat = phi - shipLatRad
    const dLng = wrapAngle(lambda - shipLngRad)
    const sinHalfLat = Math.sin(dLat * 0.5)
    const sinHalfLng = Math.sin(dLng * 0.5)
    const a =
      sinHalfLat * sinHalfLat + shipCosLat * cosPhi * sinHalfLng * sinHalfLng
    const distance = RADIUS * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))

    let relativeBearing = 0
    let inVisionRange = false
    if (distance <= MAX_VISION_ARC) {
      const y = Math.sin(dLng) * cosPhi
      const x = shipCosLat * sinPhi - shipSinLat * cosPhi * Math.cos(dLng)
      relativeBearing = wrapRelative(Math.atan2(y, x) - shipBearing)
      inVisionRange = true
    }

    rocks[index] = {
      id: rock.id,
      distance,
      relativeBearing,
      inVisionRange,
      radius: rockRadiusBySize(rock.size),
    }
    index += 1

    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestCosPhi = cosPhi
      nearestSinPhi = sinPhi
      nearestDLambda = dLng
      nearestRelativeBearing = inVisionRange
        ? relativeBearing
        : wrapRelative(
            Math.atan2(
              Math.sin(dLng) * cosPhi,
              shipCosLat * sinPhi - shipSinLat * cosPhi * Math.cos(dLng)
            ) - shipBearing
          )
      hasNearest = true
    }
  }

  return {
    shipLatRad,
    shipLngRad,
    shipSinLat,
    shipCosLat,
    nearestCosPhi,
    nearestSinPhi,
    nearestDLambda,
    nearestRelativeBearing,
    hasNearest,
    centroidX,
    centroidY,
    centroidZ,
    rocks,
  }
}

function isWithinVisionBounds(
  ship: ShipGeoContext,
  entityLatDeg: number,
  entityLngDeg: number
): boolean {
  const dLat = Math.abs((entityLatDeg - ship.latDeg) * DEG_TO_RAD)
  if (dLat > ship.maxVisionAngle) return false
  const dLng = Math.abs(wrapAngle((entityLngDeg - ship.lngDeg) * DEG_TO_RAD))
  return dLng <= ship.maxLngDelta
}

function wrapRelative(angle: number): number {
  let rel = angle
  while (rel > Math.PI) rel -= TWO_PI
  while (rel < -Math.PI) rel += TWO_PI
  return rel
}

function collectShipObservation(
  state: GameState,
  playerId: string,
  frame: ObservationFrame
): {
  alive: boolean
  lat: number
  lng: number
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
      lat: 0,
      lng: 0,
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
    lat: ship.lat,
    lng: ship.lng,
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
  prevDistances: Map<string, number>,
  invDtSeconds: number,
  lidar: LidarHit[]
): void {
  for (const rock of rockPerception.rocks) {
    if (!rock.inVisionRange) continue
    const key = prevDistanceKey('rock', rock.id)
    const closing = closingSpeedFromPrev(
      prevDistances,
      key,
      rock.distance,
      invDtSeconds
    )
    updateRayHit(
      lidar,
      rock.relativeBearing,
      rock.distance,
      rock.radius,
      closing,
      true
    )
  }
}

function scanBullets(
  state: GameState,
  prevDistances: Map<string, number>,
  invDtSeconds: number,
  ship: ShipGeoContext,
  lidar: LidarHit[]
): void {
  for (const bullet of state.bullets.values()) {
    if (!isWithinVisionBounds(ship, bullet.lat, bullet.lng)) continue
    const phi2 = bullet.lat * DEG_TO_RAD
    const cosPhi2 = Math.cos(phi2)
    const dLat = phi2 - ship.latRad
    const dLng = (bullet.lng - ship.lngDeg) * DEG_TO_RAD

    const sinHalfLat = Math.sin(dLat * 0.5)
    const sinHalfLng = Math.sin(dLng * 0.5)
    const a =
      sinHalfLat * sinHalfLat + ship.cosLat * cosPhi2 * sinHalfLng * sinHalfLng
    const dist = RADIUS * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
    if (dist > MAX_VISION_ARC) continue

    const y = Math.sin(dLng) * cosPhi2
    const x =
      ship.cosLat * Math.sin(phi2) - ship.sinLat * cosPhi2 * Math.cos(dLng)
    const relativeBearing = wrapRelative(Math.atan2(y, x) - ship.shipBearing)

    const key = prevDistanceKey('bullet', bullet.id)
    const closing = closingSpeedFromPrev(prevDistances, key, dist, invDtSeconds)
    updateRayHit(lidar, relativeBearing, dist, 0.03, closing, false)
  }
}

export function collectObservations(
  state: GameState,
  playerId: string,
  prevDistances: Map<string, number>,
  dtMs: number,
  frameBuffer?: ObservationFrame,
  rockPerceptionBuffer?: RockPerceptionPrecompute
): ObservationFrame {
  const frame = frameBuffer ?? createObservationFrameBuffer()
  if (frameBuffer != null) {
    resetLidar(frame.lidar)
  }
  const ship = collectShipObservation(state, playerId, frame)
  if (!ship.alive) {
    return frame
  }

  const shipGeo = createShipGeoContext(ship.lat, ship.lng, ship.shipBearing)
  const rockPerception =
    rockPerceptionBuffer ??
    buildRockPerceptionPrecompute(state, ship.lat, ship.lng, ship.shipBearing)
  const invDtSeconds = dtMs > 0 ? 1000 / dtMs : 0

  scanRocks(rockPerception, prevDistances, invDtSeconds, frame.lidar)
  scanBullets(state, prevDistances, invDtSeconds, shipGeo, frame.lidar)

  return frame
}
