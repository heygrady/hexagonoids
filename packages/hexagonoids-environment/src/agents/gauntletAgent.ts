import {
  elapsed,
  FIRE_COOLDOWN,
  greatCircleDistance,
  integrateAngularVelocity,
  MAX_SPEED,
  quaternionToLatLng,
  RADIUS,
} from '@heygrady/hexagonoids-engine'
import {
  relativeBearing,
  sphericalBearing,
  yawToBearing,
} from '../utils/sphericalBearing.js'
import {
  BULLET_RANGE,
  collisionRadius,
  computeLeadAim,
  DT_MS,
  rockRadius,
} from './seekDestroyUtils.js'
import type { AgentFn } from './types.js'

// ── Tuning constants ─────────────────────────────────────────────────────────

/** Engage range: coast and fire within this distance */
const ENGAGE_RANGE = BULLET_RANGE * 0.9

/** Top speed to maintain while in pursuit mode */
const MAX_PURSUE_SPEED = MAX_SPEED * 0.8

/** Dead-zone for steering to reduce oscillation (radians, ~3°) */
const TURN_DEAD_ZONE = 0.05

/** Fire alignment: minimum window (radians, ~7°) */
const FIRE_ALIGNMENT_MIN = 0.12

// ── Agent ────────────────────────────────────────────────────────────────────

interface GauntletMemory {
  turnDuration: number // ms of continuous turning in same direction
  lastTurnDir: -1 | 0 | 1 // -1 = left, 0 = none, 1 = right
}

function getMemory(context: Parameters<AgentFn>[2]): GauntletMemory {
  const mem = context.memory
  if (mem['turnDuration'] === undefined) mem['turnDuration'] = 0
  if (mem['lastTurnDir'] === undefined) mem['lastTurnDir'] = 0
  return mem as unknown as GauntletMemory
}

export const gauntletAgent: AgentFn = (state, playerId, context) => {
  const noOp = { left: false, right: false, thrust: false, fire: false }

  const player = state.players.get(playerId)
  if (player == null) return noOp
  const ship =
    player.shipId != null ? state.ships.get(player.shipId) : undefined
  if (ship == null || !ship.alive) return noOp

  const mem = getMemory(context)

  // ── 1. Identify Target ─────────────────────────────────────────────────
  let nearestRock = null
  let minDistance = Number.POSITIVE_INFINITY

  for (const rock of state.rocks.values()) {
    const dist = greatCircleDistance(
      ship.lat,
      ship.lng,
      rock.lat,
      rock.lng,
      RADIUS
    )
    if (dist < minDistance) {
      minDistance = dist
      nearestRock = rock
    }
  }

  if (nearestRock == null) return noOp

  // ── 2. Telemetry & Safety Assessment ───────────────────────────────────
  const speed = ship.angularVelocity.length()
  const engineYawInBearing = yawToBearing(ship.yaw)
  const { bearing: leadBearing, interceptDist } = computeLeadAim(
    ship.lat,
    ship.lng,
    nearestRock
  )

  // Determine true movement trajectory by looking 100ms into the future
  const trueVelocityBearing = (() => {
    if (speed < 0.001) return engineYawInBearing // Stationary
    const futureOri = integrateAngularVelocity(
      ship.orientation,
      ship.angularVelocity,
      0.1
    )
    const [fLat, fLng] = quaternionToLatLng(futureOri, RADIUS)
    return sphericalBearing(ship.lat, ship.lng, fLat, fLng)
  })()

  // Calculate safety margins
  const colRadius = collisionRadius(nearestRock.size)

  // Safety margin for fly-by clearance and approach angle
  const safeRadius = colRadius * 2.5
  const safeAngle = Math.asin(
    Math.min(1, safeRadius / Math.max(0.001, minDistance))
  )

  // How far off our current trajectory is from a direct hit
  const driftAngleToTarget = Math.abs(
    relativeBearing(trueVelocityBearing, leadBearing)
  )

  // We are safe if barely moving, or if our trajectory clears the wide fly-by angle.
  // Moving away from the rock creates driftAngle > 90°, so evaluates safe.
  const isTrajectorySafe = speed < 0.05 || driftAngleToTarget > safeAngle

  // ── 3. Universal Firing Logic ──────────────────────────────────────────
  const canFire = elapsed(state, ship.firedAt) >= FIRE_COOLDOWN
  const relLeadBearing = relativeBearing(leadBearing, engineYawInBearing)
  const r = rockRadius(nearestRock.size)
  const fireWindow = Math.max(
    FIRE_ALIGNMENT_MIN,
    (r / Math.max(interceptDist, 0.001)) * 1.6 + 0.04
  )
  const isInFireWindow = Math.abs(relLeadBearing) < fireWindow

  // Always pull the trigger if aligned and in range, regardless of engine mode
  const fire = canFire && isInFireWindow && interceptDist < ENGAGE_RANGE

  // ── 4. State Machine Steering Logic ────────────────────────────────────
  let targetSteeringBearing: number
  let thrust: boolean

  if (!isTrajectorySafe && minDistance < ENGAGE_RANGE * 1.2) {
    // ── MODE 1: EVADE ────────────────────────────────────────────────────
    // Trajectory is dangerous. Turn perpendicular to escape.
    const dodgeDir =
      relativeBearing(trueVelocityBearing, leadBearing) > 0 ? -1 : 1
    targetSteeringBearing = leadBearing + dodgeDir * (Math.PI / 2)

    const noseAlignment = Math.abs(
      relativeBearing(targetSteeringBearing, engineYawInBearing)
    )
    // Only punch the gas when nose is reasonably pointed toward escape angle
    thrust = noseAlignment < Math.PI / 3
  } else if (isTrajectorySafe && interceptDist < ENGAGE_RANGE) {
    // ── MODE 2: DRIFT & ENGAGE ───────────────────────────────────────────
    // Trajectory clears the rock. Kill engine, aim, and shoot while sliding past.
    targetSteeringBearing = leadBearing
    thrust = false
  } else {
    // ── MODE 3: REPOSITION / PURSUE ──────────────────────────────────────
    // Safe, but too far away or stationary. Charge directly at target.
    targetSteeringBearing = leadBearing

    // Thrust to approach — speed limit prevents dangerous overshoot
    thrust = speed < MAX_PURSUE_SPEED
  }

  // ── 5. Execution ───────────────────────────────────────────────────────
  const finalRelBearing = relativeBearing(
    targetSteeringBearing,
    engineYawInBearing
  )
  const left = finalRelBearing < -TURN_DEAD_ZONE
  const right = finalRelBearing > TURN_DEAD_ZONE

  const turnDir: -1 | 0 | 1 = left ? -1 : right ? 1 : 0
  if (turnDir !== 0 && turnDir === mem.lastTurnDir) {
    mem.turnDuration += DT_MS
  } else {
    mem.turnDuration = turnDir !== 0 ? DT_MS : 0
  }
  mem.lastTurnDir = turnDir

  return { left, right, thrust, fire }
}
