import type { RockState } from '@heygrady/hexagonoids-engine'
import {
  BULLET_LIFETIME,
  BULLET_SPEED,
  elapsed,
  FIRE_COOLDOWN,
  greatCircleDistance,
  RADIUS,
  ROCK_LARGE_RADIUS,
  SHIP_RADIUS,
} from '@heygrady/hexagonoids-engine'

import { relativeBearing, sphericalBearing } from '../utils/sphericalBearing.js'
import type { AgentFn } from './types.js'

interface SeekDestroyMemory {
  lastTargetId: string | null
}

interface RockInfo {
  rock: RockState
  arcDist: number
  relBearing: number
}

/** Maximum arc distance (world units) a bullet can travel before expiring. */
const BULLET_RANGE = (BULLET_SPEED * BULLET_LIFETIME * RADIUS) / 1000

/** Turning dead-zone to prevent oscillation (~3°). */
const TURN_THRESHOLD = 0.05

/** Arc distance at which a rock triggers dodge override (world units). */
const DANGER_DISTANCE = SHIP_RADIUS + ROCK_LARGE_RADIUS + 0.05

/**
 * Fire half-angle: fire when any rock within range is within ±PI/2 of heading.
 * This gives broad hemisphere coverage while avoiding shooting backwards.
 */
const FIRE_CONE = Math.PI / 2

/** Initialize and return typed agent memory from the shared context.memory bag. */
function getMemory(context: Parameters<AgentFn>[2]): SeekDestroyMemory {
  const mem = context.memory
  if (mem['lastTargetId'] === undefined) {
    mem['lastTargetId'] = null
  }
  return mem as unknown as SeekDestroyMemory
}

/**
 * Deterministic seek-and-destroy agent — the near-optimal baseline.
 * Strategy: always thrust for mobility, steer toward the easiest-to-hit rock,
 * fire when any rock is in the forward hemisphere for high coverage. Dodge
 * only when a rock is at collision distance.
 *
 * Intentional spec deviations (documented in SESSION_02 learnings):
 * - Fire uses a flat PI/2 hemisphere (FIRE_CONE) rather than per-rock angular
 *   size. This improves coverage at the cost of some wasted shots.
 * - Thrust is always-on rather than modulated by distance. Simpler and
 *   sufficient for a deterministic baseline; overshooting is acceptable.
 */
export const seekDestroyAgent: AgentFn = (state, playerId, context) => {
  const noOp = { left: false, right: false, thrust: false, fire: false }

  // Look up ship
  const player = state.players.get(playerId)
  if (player == null) return noOp
  const ship =
    player.shipId != null ? state.ships.get(player.shipId) : undefined
  if (ship == null || !ship.alive) return noOp

  const canFire = elapsed(state, ship.firedAt) >= FIRE_COOLDOWN

  // Memory for target persistence
  const mem = getMemory(context)

  // --- Pre-compute bearings for all rocks ---
  let closestDanger: RockInfo | undefined
  let anyRockAhead = false
  let bestTarget: RockInfo | undefined
  let bestScore = Infinity

  for (const rock of state.rocks.values()) {
    const arcDist = greatCircleDistance(
      ship.lat,
      ship.lng,
      rock.lat,
      rock.lng,
      RADIUS
    )
    const absBearing = sphericalBearing(ship.lat, ship.lng, rock.lat, rock.lng)
    const relBear = relativeBearing(absBearing, ship.yaw)
    const info: RockInfo = { rock, arcDist, relBearing: relBear }

    // Track if any rock is in the forward hemisphere and in bullet range
    if (arcDist <= BULLET_RANGE && Math.abs(relBear) < FIRE_CONE) {
      anyRockAhead = true
    }

    // Track closest danger
    if (
      arcDist < DANGER_DISTANCE &&
      (closestDanger == null || arcDist < closestDanger.arcDist)
    ) {
      closestDanger = info
    }

    // Track best target by rotational distance
    if (arcDist <= BULLET_RANGE) {
      const rotDist = Math.abs(relBear)
      const bias = rock.id === mem.lastTargetId ? 0.15 : 0
      const score = rotDist - bias
      if (score < bestScore) {
        bestScore = score
        bestTarget = info
      }
    }
  }

  // --- Danger avoidance override ---
  if (closestDanger != null) {
    return {
      left: closestDanger.relBearing > 0,
      right: closestDanger.relBearing <= 0,
      thrust: true,
      fire: canFire && anyRockAhead,
    }
  }

  if (bestTarget == null) {
    mem.lastTargetId = null
    // No target in range — thrust forward
    return { left: false, right: false, thrust: true, fire: false }
  }

  mem.lastTargetId = bestTarget.rock.id

  // --- Turn toward target ---
  const left = bestTarget.relBearing < -TURN_THRESHOLD
  const right = bestTarget.relBearing > TURN_THRESHOLD

  // --- Fire when any rock is in the forward hemisphere ---
  const fire = canFire && anyRockAhead

  // --- Always thrust ---
  return { left, right, thrust: true, fire }
}
