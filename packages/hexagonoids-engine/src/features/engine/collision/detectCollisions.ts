import {
  buildSpatialIndex,
  type SpatialPoint,
  type SpatialRockEntity,
} from '../../spatial-index/index.js'
import {
  BULLET_RADIUS,
  RADIUS,
  SHIP_RADIUS,
  SHIP_REGENERATION_GRACE_PERIOD,
} from '../constants.js'
import type { ManagedSpatialQueries } from '../createManagedSpatialQueries.js'
import { elapsed } from '../gameTime.js'
import type {
  BulletState,
  CollisionType,
  EntityRef,
  GameState,
} from '../types.js'

export interface CollisionPair {
  a: EntityRef
  b: EntityRef
  type: CollisionType
  distance: number
}

const DEG_TO_RAD = Math.PI / 180

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

function entityPoint(entity: {
  x: number
  y: number
  z: number
}): SpatialPoint {
  return {
    x: entity.x,
    y: entity.y,
    z: entity.z,
  }
}

function dotProduct(a: SpatialPoint, b: SpatialPoint): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function chordDistanceFromDot(dotValue: number, radius: number): number {
  return (
    Math.sqrt(Math.max(0, 2 - 2 * Math.max(-1, Math.min(1, dotValue)))) * radius
  )
}

function checkBulletRockCollisions(
  bullets: Map<string, BulletState>,
  radius: number,
  spatialQueries: Pick<ManagedSpatialQueries, 'findFirstRockIntersect'>,
  pairs: CollisionPair[]
): void {
  if (bullets.size === 0) return
  for (const bullet of bullets.values()) {
    const bulletPoint = entityPoint(bullet)
    const rockCandidate = spatialQueries.findFirstRockIntersect(
      bulletPoint,
      BULLET_RADIUS
    )
    if (rockCandidate != null) {
      const dot = dotProduct(bulletPoint, rockCandidate.point)
      pairs.push({
        a: { id: bullet.id, type: 'bullet' },
        b: { id: rockCandidate.entity.id, type: 'rock' },
        type: 'bullet-rock',
        distance: chordDistanceFromDot(dot, radius),
      })
    }
  }
}

function checkShipRockCollisions(
  state: GameState,
  radius: number,
  spatialQueries: Pick<ManagedSpatialQueries, 'findFirstRockIntersect'>,
  pairs: CollisionPair[]
): void {
  if (state.ships.size === 0) return
  for (const ship of state.ships.values()) {
    if (!ship.alive) continue

    // Skip ships in grace period after regeneration
    const player = state.players.get(ship.playerId)
    if (player != null && player.regeneratedAt != null) {
      if (elapsed(state, player.regeneratedAt) < SHIP_REGENERATION_GRACE_PERIOD)
        continue
    }

    const shipPoint = entityPoint(ship)
    const rockCandidate = spatialQueries.findFirstRockIntersect(
      shipPoint,
      SHIP_RADIUS
    )
    if (rockCandidate != null) {
      const dot = dotProduct(shipPoint, rockCandidate.point)
      pairs.push({
        a: { id: ship.id, type: 'ship' },
        b: { id: rockCandidate.entity.id, type: 'rock' },
        type: 'ship-rock',
        distance: chordDistanceFromDot(dot, radius),
      })
    }
  }
}

/**
 * Detect all colliding entity pairs this tick.
 * Uses great-circle distance on the sphere surface.
 */
export function detectCollisions(
  state: GameState,
  radius: number = RADIUS,
  spatialQueries?: Pick<ManagedSpatialQueries, 'findFirstRockIntersect'>
): CollisionPair[] {
  const pairs: CollisionPair[] = []
  if (state.rocks.size === 0) return pairs
  const fallbackIndex = spatialQueries == null ? buildSpatialIndex(state) : null
  const queries =
    spatialQueries ??
    ({
      findFirstRockIntersect(
        center,
        queryRadius
      ): SpatialRockEntity | undefined {
        return fallbackIndex!
          .queryRocksIntersect({
            center,
            radius: queryRadius,
          })
          .at(0)
      },
    } satisfies Pick<ManagedSpatialQueries, 'findFirstRockIntersect'>)
  checkBulletRockCollisions(state.bullets, radius, queries, pairs)
  checkShipRockCollisions(state, radius, queries, pairs)

  // Ship-ship collisions stubbed for future arena mode

  return pairs
}
