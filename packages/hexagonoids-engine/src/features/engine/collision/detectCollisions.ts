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
  const dLat = (lat2 - lat1) * DEG_TO_RAD
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
  radius: number
}

function wrapRadians(value: number): number {
  let v = value
  while (v > Math.PI) v -= Math.PI * 2
  while (v < -Math.PI) v += Math.PI * 2
  return v
}

// Fast small-angle approximation used only for prefiltering candidate rocks.
function approximateArcDistance(
  lat1Deg: number,
  lng1Deg: number,
  lat2Deg: number,
  lng2Deg: number,
  radius: number
): number {
  const lat1 = lat1Deg * DEG_TO_RAD
  const lat2 = lat2Deg * DEG_TO_RAD
  const dLat = lat2 - lat1
  const dLng = wrapRadians((lng2Deg - lng1Deg) * DEG_TO_RAD)
  const meanLat = (lat1 + lat2) * 0.5
  const x = dLng * Math.cos(meanLat)
  return Math.sqrt(dLat * dLat + x * x) * radius
}

function addCandidateRock(
  candidates: Map<string, RockState>,
  rock: RockState
): void {
  if (!candidates.has(rock.id)) {
    candidates.set(rock.id, rock)
  }
}

function gatherShipInfluenceCenters(
  state: GameState,
  radius: number
): InfluenceCenter[] {
  const centers: InfluenceCenter[] = []
  const furthestBulletByShip = new Map<string, number>()

  for (const bullet of state.bullets.values()) {
    const owner = state.ships.get(bullet.ownerId)
    if (owner == null || !owner.alive) {
      centers.push({
        lat: bullet.lat,
        lng: bullet.lng,
        radius: ROCK_RELEVANCE_MARGIN,
      })
      continue
    }

    const bulletDistance = greatCircleDistance(
      owner.lat,
      owner.lng,
      bullet.lat,
      bullet.lng,
      radius
    )
    const prev = furthestBulletByShip.get(owner.id) ?? 0
    if (bulletDistance > prev) {
      furthestBulletByShip.set(owner.id, bulletDistance)
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
      radius: shipRadius + BULLET_TRAVEL_DISTANCE + ROCK_RELEVANCE_MARGIN,
    })
  }

  return centers
}

function gatherCandidateRocks(state: GameState, radius: number): RockState[] {
  if (state.rocks.size === 0) return []
  const centers = gatherShipInfluenceCenters(state, radius)
  if (centers.length === 0) {
    return Array.from(state.rocks.values())
  }

  const candidates = new Map<string, RockState>()
  const prefilterSlack = 0.08
  for (const rock of state.rocks.values()) {
    for (const center of centers) {
      const dist = approximateArcDistance(
        center.lat,
        center.lng,
        rock.lat,
        rock.lng,
        radius
      )
      if (dist <= center.radius + prefilterSlack) {
        addCandidateRock(candidates, rock)
        break
      }
    }
  }
  return Array.from(candidates.values())
}

function checkBulletRockCollisions(
  bullets: Map<string, BulletState>,
  rocks: readonly RockState[],
  radius: number,
  pairs: CollisionPair[]
): void {
  if (rocks.length === 0 || bullets.size === 0) return
  for (const bullet of bullets.values()) {
    for (const rock of rocks) {
      const dist = greatCircleDistance(
        bullet.lat,
        bullet.lng,
        rock.lat,
        rock.lng,
        radius
      )
      const threshold = BULLET_RADIUS + rockRadiusForSize(rock.size)
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
  rocks: readonly RockState[],
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

    for (const rock of rocks) {
      const dist = greatCircleDistance(
        ship.lat,
        ship.lng,
        rock.lat,
        rock.lng,
        radius
      )
      const threshold = SHIP_RADIUS + rockRadiusForSize(rock.size)
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
