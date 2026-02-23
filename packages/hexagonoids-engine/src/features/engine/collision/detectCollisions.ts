import {
  BULLET_RADIUS,
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

function checkBulletRockCollisions(
  bullets: Map<string, BulletState>,
  rocks: Map<string, RockState>,
  radius: number,
  pairs: CollisionPair[]
): void {
  for (const bullet of bullets.values()) {
    for (const rock of rocks.values()) {
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
  radius: number,
  pairs: CollisionPair[]
): void {
  for (const ship of state.ships.values()) {
    if (!ship.alive) continue

    // Skip ships in grace period after regeneration
    const player = state.players.get(ship.playerId)
    if (player != null && player.regeneratedAt != null) {
      if (elapsed(state, player.regeneratedAt) < SHIP_REGENERATION_GRACE_PERIOD)
        continue
    }

    for (const rock of state.rocks.values()) {
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

  checkBulletRockCollisions(state.bullets, state.rocks, radius, pairs)
  checkShipRockCollisions(state, radius, pairs)

  // Ship-ship collisions stubbed for future arena mode

  return pairs
}
