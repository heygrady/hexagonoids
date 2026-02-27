import {
  BULLET_RADIUS,
  BULLET_TRAVEL_DISTANCE,
  RADIUS,
  ROCK_LARGE_RADIUS,
  ROCK_MEDIUM_RADIUS,
  ROCK_SMALL_RADIUS,
  SHIP_RADIUS,
  SHIP_REGENERATION_GRACE_PERIOD,
} from '../constants.js'
import { elapsed } from '../gameTime.js'
import type {
  BulletState,
  CollisionType,
  EntityRef,
  GameState,
  RockState,
} from '../types.js'

export interface CollisionPair {
  a: EntityRef
  b: EntityRef
  type: CollisionType
  distance: number
}

const DEG_TO_RAD = Math.PI / 180
const ROCK_RELEVANCE_MARGIN = ROCK_LARGE_RADIUS + BULLET_RADIUS
const COLLISION_PREFILTER_SLACK = 0.12

/**
 * Great-circle distance between two lat/lng points on a sphere.
 * Uses the Haversine formula for numerical stability.
 */
export function greatCircleDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  radius: number
): number {
  const lat1Rad = lat1 * DEG_TO_RAD
  const lat2Rad = lat2 * DEG_TO_RAD
  const dLat = lat2Rad - lat1Rad
  const dLng = (lng2 - lng1) * DEG_TO_RAD

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return radius * c
}

function rockRadiusForSize(size: 0 | 1 | 2): number {
  switch (size) {
    case 2:
      return ROCK_LARGE_RADIUS
    case 1:
      return ROCK_MEDIUM_RADIUS
    case 0:
      return ROCK_SMALL_RADIUS
  }
}

interface InfluenceCenter {
  lat: number
  lng: number
  latRad: number
  cosLat: number
  radius: number
}

interface GeoPoint {
  lat: number
  lng: number
  latRad: number
  cosLat: number
}

interface CandidateRock {
  rock: RockState
  geo: GeoPoint
  radius: number
}

function wrapRadians(value: number): number {
  let v = value
  while (v > Math.PI) v -= Math.PI * 2
  while (v < -Math.PI) v += Math.PI * 2
  return v
}

function geoPoint(lat: number, lng: number): GeoPoint {
  const latRad = lat * DEG_TO_RAD
  return {
    lat,
    lng,
    latRad,
    cosLat: Math.cos(latRad),
  }
}

function approximateArcDistanceComponents(
  dLat: number,
  dLng: number,
  meanLat: number,
  radius: number
): number {
  const x = dLng * Math.cos(meanLat)
  return Math.sqrt(dLat * dLat + x * x) * radius
}

function greatCircleDistanceGeo(
  a: GeoPoint,
  b: GeoPoint,
  radius: number
): number {
  return greatCircleDistanceComponents(
    b.latRad - a.latRad,
    (b.lng - a.lng) * DEG_TO_RAD,
    a.cosLat,
    b.cosLat,
    radius
  )
}

function greatCircleDistanceComponents(
  dLat: number,
  dLng: number,
  cosLatA: number,
  cosLatB: number,
  radius: number
): number {
  const sinHalfLat = Math.sin(dLat * 0.5)
  const sinHalfLng = Math.sin(dLng * 0.5)
  const aa =
    sinHalfLat * sinHalfLat + cosLatA * cosLatB * sinHalfLng * sinHalfLng
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
  return radius * c
}

function longitudeArcLowerBound(
  dLngRad: number,
  cosLatA: number,
  cosLatB: number,
  radius: number
): number {
  const minCos = Math.max(0.08, Math.min(Math.abs(cosLatA), Math.abs(cosLatB)))
  return Math.abs(dLngRad) * minCos * radius
}

function gatherShipInfluenceCenters(
  state: GameState,
  radius: number
): InfluenceCenter[] {
  const centers: InfluenceCenter[] = []
  const furthestBulletByShip = new Map<string, number>()
  const shipGeoById = new Map<string, GeoPoint>()
  for (const ship of state.ships.values()) {
    if (ship.alive) {
      shipGeoById.set(ship.id, geoPoint(ship.lat, ship.lng))
    }
  }

  for (const bullet of state.bullets.values()) {
    const ownerGeo = shipGeoById.get(bullet.ownerId)
    if (ownerGeo == null) {
      const bulletGeo = geoPoint(bullet.lat, bullet.lng)
      centers.push({
        lat: bulletGeo.lat,
        lng: bulletGeo.lng,
        latRad: bulletGeo.latRad,
        cosLat: bulletGeo.cosLat,
        radius: ROCK_RELEVANCE_MARGIN,
      })
      continue
    }

    const bulletGeo = geoPoint(bullet.lat, bullet.lng)
    const bulletDistance = greatCircleDistanceGeo(ownerGeo, bulletGeo, radius)
    const prev = furthestBulletByShip.get(bullet.ownerId) ?? 0
    if (bulletDistance > prev) {
      furthestBulletByShip.set(bullet.ownerId, bulletDistance)
    }
  }

  for (const ship of state.ships.values()) {
    if (!ship.alive) continue
    const player = state.players.get(ship.playerId)
    const hasGrace =
      player?.regeneratedAt != null &&
      elapsed(state, player.regeneratedAt) < SHIP_REGENERATION_GRACE_PERIOD

    const shipRadius = hasGrace
      ? (furthestBulletByShip.get(ship.id) ?? 0)
      : Math.max(
          SHIP_RADIUS + ROCK_LARGE_RADIUS,
          furthestBulletByShip.get(ship.id) ?? 0
        )

    centers.push({
      lat: ship.lat,
      lng: ship.lng,
      latRad: shipGeoById.get(ship.id)?.latRad ?? ship.lat * DEG_TO_RAD,
      cosLat:
        shipGeoById.get(ship.id)?.cosLat ?? Math.cos(ship.lat * DEG_TO_RAD),
      radius: shipRadius + BULLET_TRAVEL_DISTANCE + ROCK_RELEVANCE_MARGIN,
    })
  }

  return centers
}

function gatherCandidateRocks(
  state: GameState,
  radius: number
): CandidateRock[] {
  if (state.rocks.size === 0) return []
  const centers = gatherShipInfluenceCenters(state, radius)
  if (centers.length === 0) {
    return Array.from(state.rocks.values(), (rock) => ({
      rock,
      geo: geoPoint(rock.lat, rock.lng),
      radius: rockRadiusForSize(rock.size),
    }))
  }

  const candidates = new Map<string, CandidateRock>()
  for (const rock of state.rocks.values()) {
    const rockGeo = geoPoint(rock.lat, rock.lng)
    for (const center of centers) {
      const threshold = center.radius + COLLISION_PREFILTER_SLACK
      const dLat = rockGeo.latRad - center.latRad
      if (Math.abs(dLat) * radius > threshold) {
        continue
      }
      const dLng = wrapRadians((rockGeo.lng - center.lng) * DEG_TO_RAD)
      if (
        longitudeArcLowerBound(dLng, center.cosLat, rockGeo.cosLat, radius) >
        threshold
      ) {
        continue
      }
      const dist = approximateArcDistanceComponents(
        dLat,
        dLng,
        (center.latRad + rockGeo.latRad) * 0.5,
        radius
      )
      if (dist <= threshold) {
        if (!candidates.has(rock.id)) {
          candidates.set(rock.id, {
            rock,
            geo: rockGeo,
            radius: rockRadiusForSize(rock.size),
          })
        }
        break
      }
    }
  }
  return Array.from(candidates.values())
}

function checkBulletRockCollisions(
  bullets: Map<string, BulletState>,
  rocks: readonly CandidateRock[],
  radius: number,
  pairs: CollisionPair[]
): void {
  if (rocks.length === 0 || bullets.size === 0) return
  for (const bullet of bullets.values()) {
    const bulletGeo = geoPoint(bullet.lat, bullet.lng)
    for (const rockCandidate of rocks) {
      const { rock, geo: rockGeo, radius: rockRadius } = rockCandidate
      const threshold = BULLET_RADIUS + rockRadius
      const prefilterThreshold = threshold + COLLISION_PREFILTER_SLACK
      const dLat = rockGeo.latRad - bulletGeo.latRad
      if (Math.abs(dLat) * radius > prefilterThreshold) {
        continue
      }
      const dLng = wrapRadians((rockGeo.lng - bulletGeo.lng) * DEG_TO_RAD)
      if (
        longitudeArcLowerBound(dLng, bulletGeo.cosLat, rockGeo.cosLat, radius) >
        prefilterThreshold
      ) {
        continue
      }
      const approxDist = approximateArcDistanceComponents(
        dLat,
        dLng,
        (bulletGeo.latRad + rockGeo.latRad) * 0.5,
        radius
      )
      if (approxDist > prefilterThreshold) {
        continue
      }

      const dist = greatCircleDistanceComponents(
        dLat,
        dLng,
        bulletGeo.cosLat,
        rockGeo.cosLat,
        radius
      )
      if (dist <= threshold) {
        pairs.push({
          a: { id: bullet.id, type: 'bullet' },
          b: { id: rock.id, type: 'rock' },
          type: 'bullet-rock',
          distance: dist,
        })
      }
    }
  }
}

function checkShipRockCollisions(
  state: GameState,
  rocks: readonly CandidateRock[],
  radius: number,
  pairs: CollisionPair[]
): void {
  if (rocks.length === 0 || state.ships.size === 0) return
  for (const ship of state.ships.values()) {
    if (!ship.alive) continue

    // Skip ships in grace period after regeneration
    const player = state.players.get(ship.playerId)
    if (player != null && player.regeneratedAt != null) {
      if (elapsed(state, player.regeneratedAt) < SHIP_REGENERATION_GRACE_PERIOD)
        continue
    }

    const shipGeo = geoPoint(ship.lat, ship.lng)
    for (const rockCandidate of rocks) {
      const { rock, geo: rockGeo, radius: rockRadius } = rockCandidate
      const threshold = SHIP_RADIUS + rockRadius
      const prefilterThreshold = threshold + COLLISION_PREFILTER_SLACK
      const dLat = rockGeo.latRad - shipGeo.latRad
      if (Math.abs(dLat) * radius > prefilterThreshold) {
        continue
      }
      const dLng = wrapRadians((rockGeo.lng - shipGeo.lng) * DEG_TO_RAD)
      if (
        longitudeArcLowerBound(dLng, shipGeo.cosLat, rockGeo.cosLat, radius) >
        prefilterThreshold
      ) {
        continue
      }
      const approxDist = approximateArcDistanceComponents(
        dLat,
        dLng,
        (shipGeo.latRad + rockGeo.latRad) * 0.5,
        radius
      )
      if (approxDist > prefilterThreshold) {
        continue
      }

      const dist = greatCircleDistanceComponents(
        dLat,
        dLng,
        shipGeo.cosLat,
        rockGeo.cosLat,
        radius
      )
      if (dist <= threshold) {
        pairs.push({
          a: { id: ship.id, type: 'ship' },
          b: { id: rock.id, type: 'rock' },
          type: 'ship-rock',
          distance: dist,
        })
      }
    }
  }
}

/**
 * Detect all colliding entity pairs this tick.
 * Uses great-circle distance on the sphere surface.
 */
export function detectCollisions(
  state: GameState,
  radius: number = RADIUS
): CollisionPair[] {
  const pairs: CollisionPair[] = []
  if (state.rocks.size === 0) return pairs

  const candidateRocks = gatherCandidateRocks(state, radius)
  if (candidateRocks.length === 0) {
    return pairs
  }

  checkBulletRockCollisions(state.bullets, candidateRocks, radius, pairs)
  checkShipRockCollisions(state, candidateRocks, radius, pairs)

  // Ship-ship collisions stubbed for future arena mode

  return pairs
}
