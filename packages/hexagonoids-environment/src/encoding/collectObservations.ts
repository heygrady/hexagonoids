import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import type { GameState, ShipState } from '@heygrady/hexagonoids-engine'
import {
  elapsed,
  FIRE_COOLDOWN,
  greatCircleDistance,
  MAX_SPEED,
  PLAYER_STARTING_LIVES,
  RADIUS,
  TURN_RATE,
} from '@heygrady/hexagonoids-engine'

import {
  relativeBearing,
  sphericalBearing,
  yawToBearing,
} from '../utils/sphericalBearing.js'
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
  const speed = ship.angularVelocity.length()
  if (speed < 0.00001) {
    return [1, 0]
  }

  // Build world-space heading from orientation + yaw
  const worldUp = Vector3.Up().applyRotationQuaternion(ship.orientation)
  const localHeadingRotation = Quaternion.RotationAxis(Vector3.Up(), ship.yaw)
  const localHeading3D =
    Vector3.Forward().applyRotationQuaternion(localHeadingRotation)
  const worldHeading = localHeading3D.applyRotationQuaternion(ship.orientation)

  // Thrust axis: worldUp × worldHeading (the direction ship accelerates toward)
  const thrustAxis = Vector3.Cross(worldUp, worldHeading)
  const axisLen = thrustAxis.length()
  if (axisLen < 0.00001) {
    return [1, 0]
  }
  thrustAxis.scaleInPlace(1 / axisLen)

  const forward = Vector3.Dot(ship.angularVelocity, thrustAxis) / speed
  const lateral = Vector3.Dot(ship.angularVelocity, worldHeading) / speed
  return [clamp(forward, -1, 1), clamp(lateral, -1, 1)]
}

function makeEmptyLidar(): LidarHit[] {
  return new Array(LIDAR_RAY_COUNT).fill(null).map(() => ({
    distanceNorm: 1,
    closingSpeed: 0,
    isRock: 0,
    isBullet: 0,
  }))
}

function rayAngleForIndex(index: number): number {
  return (index / LIDAR_RAY_COUNT) * TWO_PI - Math.PI
}

function rayIndexFromRelativeBearing(relative: number): number {
  const normalized = (relative + Math.PI) / TWO_PI
  return Math.floor(normalized * LIDAR_RAY_COUNT) % LIDAR_RAY_COUNT
}

function updateRayHit(
  lidar: LidarHit[],
  shipLat: number,
  shipLng: number,
  shipBearing: number,
  entityLat: number,
  entityLng: number,
  arcDist: number,
  entityRadius: number,
  closingSpeed: number,
  isRock: boolean
): void {
  if (arcDist > MAX_VISION_ARC) return

  const absBearing = sphericalBearing(shipLat, shipLng, entityLat, entityLng)
  const relBearing = relativeBearing(absBearing, shipBearing)
  const centerRayIndex = rayIndexFromRelativeBearing(relBearing)

  // Approximate angular width of entity from ship center.
  const radiusArc = clamp(entityRadius / RADIUS, 0.001, 0.35)

  // Update neighboring rays if entity spans multiple directions.
  for (let offset = -2; offset <= 2; offset++) {
    const idx = (centerRayIndex + offset + LIDAR_RAY_COUNT) % LIDAR_RAY_COUNT
    const rayAngle = rayAngleForIndex(idx)
    const delta = Math.abs(wrapAngle(relBearing - rayAngle))
    if (delta > radiusArc) continue

    const current = lidar[idx]
    if (current == null) continue
    const distanceNorm = clamp(arcDist / MAX_VISION_ARC, 0, 1)
    if (distanceNorm >= current.distanceNorm) continue

    current.distanceNorm = distanceNorm
    current.closingSpeed = clamp(closingSpeed / MAX_CLOSING_SPEED, -1, 1)
    current.isRock = isRock ? 1 : 0
    current.isBullet = isRock ? 0 : 1
  }
}

function prevDistanceKey(entityType: 'rock' | 'bullet', id: string): string {
  return `${entityType}:${id}`
}

function collectShipObservation(
  state: GameState,
  playerId: string
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
    return {
      alive: false,
      lat: 0,
      lng: 0,
      shipBearing: 0,
      ship: {
        speedNorm: 0,
        headingForwardDrift: 0,
        headingLateralDrift: 0,
        angularVelocityNorm: 0,
      },
      temporal: {
        cooldownNorm: 0,
        livesNorm: clamp((player?.lives ?? 0) / PLAYER_STARTING_LIVES, 0, 1),
      },
    }
  }

  const [forward, lateral] = headingVelocityComponents(ship)

  return {
    alive: true,
    lat: ship.lat,
    lng: ship.lng,
    shipBearing: yawToBearing(ship.yaw),
    ship: {
      speedNorm: clamp(ship.angularVelocity.length() / MAX_SPEED, 0, 1),
      headingForwardDrift: forward,
      headingLateralDrift: lateral,
      angularVelocityNorm: clamp(
        ship.angularVelocity.length() / TURN_RATE,
        0,
        1
      ),
    },
    temporal: {
      cooldownNorm: clamp(elapsed(state, ship.firedAt) / FIRE_COOLDOWN, 0, 1),
      livesNorm: clamp((player?.lives ?? 0) / PLAYER_STARTING_LIVES, 0, 1),
    },
  }
}

function closingSpeedFromPrev(
  prevDistances: Map<string, number>,
  key: string,
  currentDistance: number,
  dtMs: number
): number {
  const prev = prevDistances.get(key)
  if (prev == null || dtMs <= 0) return 0
  return (prev - currentDistance) / (dtMs / 1000)
}

function scanRocks(
  state: GameState,
  prevDistances: Map<string, number>,
  dtMs: number,
  shipLat: number,
  shipLng: number,
  shipBearing: number,
  lidar: LidarHit[]
): void {
  for (const rock of state.rocks.values()) {
    const dist = greatCircleDistance(
      shipLat,
      shipLng,
      rock.lat,
      rock.lng,
      RADIUS
    )
    if (dist > MAX_VISION_ARC) continue
    const key = prevDistanceKey('rock', rock.id)
    const closing = closingSpeedFromPrev(prevDistances, key, dist, dtMs)
    const radius = rock.size === 2 ? 0.26 : rock.size === 1 ? 0.13 : 0.07
    updateRayHit(
      lidar,
      shipLat,
      shipLng,
      shipBearing,
      rock.lat,
      rock.lng,
      dist,
      radius,
      closing,
      true
    )
  }
}

function scanBullets(
  state: GameState,
  prevDistances: Map<string, number>,
  dtMs: number,
  shipLat: number,
  shipLng: number,
  shipBearing: number,
  lidar: LidarHit[]
): void {
  for (const bullet of state.bullets.values()) {
    const dist = greatCircleDistance(
      shipLat,
      shipLng,
      bullet.lat,
      bullet.lng,
      RADIUS
    )
    if (dist > MAX_VISION_ARC) continue
    const key = prevDistanceKey('bullet', bullet.id)
    const closing = closingSpeedFromPrev(prevDistances, key, dist, dtMs)
    updateRayHit(
      lidar,
      shipLat,
      shipLng,
      shipBearing,
      bullet.lat,
      bullet.lng,
      dist,
      0.03,
      closing,
      false
    )
  }
}

export function collectObservations(
  state: GameState,
  playerId: string,
  prevDistances: Map<string, number>,
  dtMs: number
): ObservationFrame {
  const ship = collectShipObservation(state, playerId)
  if (!ship.alive) {
    return {
      shipAlive: false,
      ship: ship.ship,
      temporal: ship.temporal,
      lidar: makeEmptyLidar(),
    }
  }

  const lidar = makeEmptyLidar()

  scanRocks(
    state,
    prevDistances,
    dtMs,
    ship.lat,
    ship.lng,
    ship.shipBearing,
    lidar
  )
  scanBullets(
    state,
    prevDistances,
    dtMs,
    ship.lat,
    ship.lng,
    ship.shipBearing,
    lidar
  )

  return {
    shipAlive: true,
    ship: ship.ship,
    temporal: ship.temporal,
    lidar,
  }
}
