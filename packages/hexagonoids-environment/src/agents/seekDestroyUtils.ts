import type { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import type { RockState } from '@heygrady/hexagonoids-engine'
import {
  BULLET_LIFETIME,
  BULLET_SPEED,
  easeCircleOut,
  greatCircleDistance,
  integrateAngularVelocity,
  MAX_DURATION,
  quaternionToLatLng,
  RADIUS,
  ROCK_LARGE_RADIUS,
  ROCK_MEDIUM_RADIUS,
  ROCK_SMALL_RADIUS,
  SHIP_RADIUS,
  TURN_RATE,
} from '@heygrady/hexagonoids-engine'

import { sphericalBearing } from '../utils/sphericalBearing.js'

// ── Constants ──────────────────────────────────────────────────────────

/** Maximum arc distance a bullet can travel */
export const BULLET_RANGE = (BULLET_SPEED * BULLET_LIFETIME * RADIUS) / 1000

/** Bullet world-space speed (arc distance per second) */
export const BULLET_WORLD_SPEED = BULLET_SPEED * RADIUS

/** Maximum bullet time-of-flight in seconds */
export const MAX_TOF = BULLET_LIFETIME / 1000

// ── Rock radius ────────────────────────────────────────────────────────

export function rockRadius(size: RockState['size']): number {
  if (size === 2) return ROCK_LARGE_RADIUS
  if (size === 1) return ROCK_MEDIUM_RADIUS
  return ROCK_SMALL_RADIUS
}

// ── Predict rock position ──────────────────────────────────────────────

/**
 * Predict a rock's future lat/lng after `tSeconds` of travel.
 * Uses the engine's quaternion integration for accuracy on the sphere.
 * Returns current position if rock is stationary.
 */
export function predictRockPosition(
  rock: RockState,
  tSeconds: number
): [lat: number, lng: number] {
  if (tSeconds <= 0 || rock.angularVelocity.lengthSquared() < 1e-10) {
    return [rock.lat, rock.lng]
  }
  const futureOrientation = integrateAngularVelocity(
    rock.orientation,
    rock.angularVelocity,
    tSeconds
  )
  return quaternionToLatLng(futureOrientation, RADIUS)
}

// ── Closing speed ──────────────────────────────────────────────────────

/**
 * Compute how fast a rock is closing on the ship in world units per second.
 * Positive = approaching, negative = receding.
 * Only considers rock motion (not ship motion) to avoid false evasion
 * when the ship is intentionally approaching a target.
 */
export function computeClosingSpeed(
  shipLat: number,
  shipLng: number,
  rock: RockState,
  dt = 0.033
): number {
  const distNow = greatCircleDistance(
    shipLat,
    shipLng,
    rock.lat,
    rock.lng,
    RADIUS
  )
  const [futureLat, futureLng] = predictRockPosition(rock, dt)
  const distFuture = greatCircleDistance(
    shipLat,
    shipLng,
    futureLat,
    futureLng,
    RADIUS
  )
  return (distNow - distFuture) / dt
}

// ── Time-to-collision ──────────────────────────────────────────────────

/**
 * Compute time-to-collision in seconds.
 * Returns Infinity if the rock is not closing.
 */
export function computeTTC(
  distance: number,
  closingSpeed: number,
  colRadius: number
): number {
  const gap = distance - colRadius
  if (gap <= 0) return 0
  if (closingSpeed <= 0) return Number.POSITIVE_INFINITY
  return gap / closingSpeed
}

/**
 * Collision radius for a rock hitting a ship.
 */
export function collisionRadius(rockSize: RockState['size']): number {
  return SHIP_RADIUS + rockRadius(rockSize)
}

// ── Threat level ───────────────────────────────────────────────────────

/**
 * Combine TTC and rock size into a single threat score.
 * Lower TTC = higher threat. Larger rocks = higher threat.
 * Returns 0 for non-threats (infinite TTC).
 */
export function computeThreatLevel(
  ttc: number,
  rockSize: RockState['size']
): number {
  if (!isFinite(ttc)) return 0
  const sizeWeight = rockSize === 2 ? 1.5 : rockSize === 1 ? 1.2 : 1.0
  return sizeWeight / Math.max(ttc, 0.01)
}

// ── Lead aim ───────────────────────────────────────────────────────────

export interface LeadAimResult {
  /** Bearing from ship to intercept point (radians, absolute) */
  bearing: number
  /** Arc distance to intercept point */
  interceptDist: number
  /** Estimated time-of-flight for bullet to reach intercept */
  tof: number
}

/**
 * 3-iteration intercept solver.
 * Estimates where the rock will be when a bullet could reach it.
 * Accounts for bullet inheriting ship velocity (bullet speed = BULLET_SPEED + shipSpeed along heading).
 * `shipForwardSpeed` is the ship's angular speed (rad/s) — bullets inherit this.
 */
export function computeLeadAim(
  shipLat: number,
  shipLng: number,
  rock: RockState,
  shipForwardSpeed = 0
): LeadAimResult {
  // Effective bullet world speed accounting for ship velocity inheritance
  const effectiveWorldSpeed = (BULLET_SPEED + shipForwardSpeed) * RADIUS
  const dist0 = greatCircleDistance(
    shipLat,
    shipLng,
    rock.lat,
    rock.lng,
    RADIUS
  )
  let tof = dist0 / effectiveWorldSpeed

  let predLat: number
  let predLng: number
  let interceptDist: number

  // 3 iterations for convergence
  for (let i = 0; i < 3; i++) {
    ;[predLat, predLng] = predictRockPosition(rock, tof)
    interceptDist = greatCircleDistance(
      shipLat,
      shipLng,
      predLat!,
      predLng!,
      RADIUS
    )
    tof = interceptDist / effectiveWorldSpeed
  }

  ;[predLat, predLng] = predictRockPosition(rock, tof)
  interceptDist = greatCircleDistance(
    shipLat,
    shipLng,
    predLat!,
    predLng!,
    RADIUS
  )
  const bearing = sphericalBearing(shipLat, shipLng, predLat!, predLng!)
  return { bearing, interceptDist, tof }
}

// ── Fire window ────────────────────────────────────────────────────────

/** Base minimum fire alignment in radians (~7°) */
const FIRE_ALIGNMENT_BASE = 0.12

/**
 * Angular half-width of the fire cone for a given rock at intercept distance.
 * Balanced between accuracy and hit rate.
 */
export function fireWindow(
  rockSize: RockState['size'],
  interceptDist: number
): number {
  const r = rockRadius(rockSize)
  const dist = Math.max(interceptDist, 0.001)
  return Math.max(FIRE_ALIGNMENT_BASE, (r / dist) * 1.6 + 0.04)
}

// ── Velocity bearing ──────────────────────────────────────────────────

/**
 * Compute the spherical bearing of the ship's current drift direction.
 * Returns radians [-PI, PI] where 0=north, positive=clockwise.
 *
 * Uses the engine's own quaternion integration to project the ship
 * forward by a small dt, then computes the geographic bearing from
 * current to future position. This guarantees compatibility with
 * `sphericalBearing()` at all positions on the sphere.
 *
 * Returns 0 if the ship is nearly stationary.
 */
export function velocityBearing(
  lat: number,
  lng: number,
  orientation: Quaternion,
  angularVelocity: Vector3
): number {
  const speed = angularVelocity.length()
  if (speed < 1e-5) return 0

  const dt = 0.033
  const futureOri = integrateAngularVelocity(orientation, angularVelocity, dt)
  const [futureLat, futureLng] = quaternionToLatLng(futureOri, RADIUS)

  return sphericalBearing(lat, lng, futureLat, futureLng)
}

// ── Ticks-to-align (easing-aware) ─────────────────────────────────────

/**
 * Fixed tick duration assumed by agent easing calculations.
 * Matches the default simulation dtMs — agents are evaluated at this rate.
 */
export const DT_MS = 33 // ms per tick

/**
 * Precomputed cumulative yaw (radians) after N ticks of continuous turning,
 * accounting for circle-out easing. Index = tick count (0 = no turn yet).
 * Covers up to 60 ticks (~2 seconds), well beyond any practical aim time.
 */
const CUMULATIVE_YAW: number[] = [0]

{
  let cumulative = 0
  for (let tick = 1; tick <= 60; tick++) {
    const duration = tick * DT_MS
    const t = Math.min(duration / MAX_DURATION, 1)
    const magnitude = ((easeCircleOut(t) * TURN_RATE) / 1000) * DT_MS
    cumulative += magnitude
    CUMULATIVE_YAW.push(cumulative)
  }
}

/**
 * How many ticks of turning are needed to rotate `angleRad` radians,
 * starting from a standstill (duration=0). Uses the precomputed easing table.
 *
 * If `currentTurnDuration` is provided (ms), accounts for already being
 * mid-turn (the easing curve is further along, so turns are faster).
 */
export function ticksToAlign(
  angleRad: number,
  currentTurnDuration = 0
): number {
  const target = Math.abs(angleRad)
  if (target <= 0) return 0

  // If already mid-turn, compute cumulative yaw from that point forward
  if (currentTurnDuration > 0) {
    let cumulative = 0
    for (let tick = 1; tick <= 60; tick++) {
      const duration = currentTurnDuration + tick * DT_MS
      const t = Math.min(duration / MAX_DURATION, 1)
      const magnitude = ((easeCircleOut(t) * TURN_RATE) / 1000) * DT_MS
      cumulative += magnitude
      if (cumulative >= target) return tick
    }
    return 61
  }

  // Standard case: starting from standstill
  for (let i = 1; i < CUMULATIVE_YAW.length; i++) {
    if (CUMULATIVE_YAW[i]! >= target) return i
  }
  return CUMULATIVE_YAW.length
}
