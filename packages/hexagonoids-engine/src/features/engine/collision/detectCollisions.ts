import {
  BULLET_RADIUS,
  RADIUS,
  SHIP_RADIUS,
  SHIP_REGENERATION_GRACE_PERIOD,
} from '../constants.js'
import {
  createManagedSpatialQueries,
  type ManagedSpatialQueries,
} from '../createManagedSpatialQueries.js'
import { elapsed } from '../gameTime.js'
import type { CollisionType, EntityRef, GameState } from '../types.js'

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

function chordDistanceFromDot(dotValue: number, radius: number): number {
  return (
    Math.sqrt(Math.max(0, 2 - 2 * Math.max(-1, Math.min(1, dotValue)))) *
    radius
  )
}

/**
 * Detect all colliding entity pairs this tick.
 * Uses the consolidated rock query interface for sphere-sphere intersection.
 */
export function detectCollisions(
  state: GameState,
  radius: number = RADIUS,
  queries?: ManagedSpatialQueries
): CollisionPair[] {
  const pairs: CollisionPair[] = []
  if (state.rocks.size === 0) return pairs
  const rockQueries =
    queries ?? createManagedSpatialQueries(() => state)

  // Bullet-rock collisions
  for (const bullet of state.bullets.values()) {
    const rock = rockQueries.findFirstRockIntersect(bullet, BULLET_RADIUS)
    if (rock != null) {
      const dot = bullet.x * rock.x + bullet.y * rock.y + bullet.z * rock.z
      pairs.push({
        a: { id: bullet.id, type: 'bullet' },
        b: { id: rock.id, type: 'rock' },
        type: 'bullet-rock',
        distance: chordDistanceFromDot(dot, radius),
      })
    }
  }

  // Ship-rock collisions
  for (const ship of state.ships.values()) {
    if (!ship.alive) continue

    const player = state.players.get(ship.playerId)
    if (player != null && player.regeneratedAt != null) {
      if (elapsed(state, player.regeneratedAt) < SHIP_REGENERATION_GRACE_PERIOD)
        continue
    }

    const rock = rockQueries.findFirstRockIntersect(ship, SHIP_RADIUS)
    if (rock != null) {
      const dot = ship.x * rock.x + ship.y * rock.y + ship.z * rock.z
      pairs.push({
        a: { id: ship.id, type: 'ship' },
        b: { id: rock.id, type: 'rock' },
        type: 'ship-rock',
        distance: chordDistanceFromDot(dot, radius),
      })
    }
  }

  return pairs
}
