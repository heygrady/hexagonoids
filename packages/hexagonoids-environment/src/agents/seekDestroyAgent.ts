import {
  elapsed,
  FIRE_COOLDOWN,
  greatCircleDistance,
  MAX_SPEED,
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
  computeClosingSpeed,
  computeLeadAim,
  computeThreatLevel,
  computeTTC,
  rockRadius,
} from './seekDestroyUtils.js'
import type { AgentFn } from './types.js'

// ── Tuning constants ───────────────────────────────────────────────────

/** Fire within this fraction of max bullet range */
const FIRE_RANGE_FACTOR = 0.9

/** Turn threshold for steering dead-zone */
const TURN_THRESHOLD = 0.01

// ── Derived ────────────────────────────────────────────────────────────

const EFFECTIVE_RANGE = BULLET_RANGE * FIRE_RANGE_FACTOR

// ── Memory ─────────────────────────────────────────────────────────────

interface SeekDestroyMemory {
  lastTargetId: string | null
  mode: 'hunt' | 'engage' | 'evade'
  tick: number
}

function getMemory(context: Parameters<AgentFn>[2]): SeekDestroyMemory {
  const mem = context.memory
  if (mem['lastTargetId'] === undefined) mem['lastTargetId'] = null
  if (mem['mode'] === undefined) mem['mode'] = 'hunt'
  if (mem['tick'] === undefined) mem['tick'] = 0
  return mem as unknown as SeekDestroyMemory
}

// ── Per-rock analysis ──────────────────────────────────────────────────

interface RockAnalysis {
  rock: { id: string; size: 0 | 1 | 2 }
  arcDist: number
  closingSpeed: number
  ttc: number
  threatLevel: number
  relBearing: number
  leadBearing: number // Absolute bearing to intercept point
  interceptDist: number
}

// ── Helpers ────────────────────────────────────────────────────────────

function steerToward(relBearing: number): { left: boolean; right: boolean } {
  return {
    left: relBearing < -TURN_THRESHOLD,
    right: relBearing > TURN_THRESHOLD,
  }
}

/**
 * Wider fire window used by seekDestroy for aggressive spray.
 * Uses 2.5x rock radius + 0.15 rad base (~8.5°) vs the precision
 * window in seekDestroyUtils (1.6x + 0.12 rad) — trades accuracy for
 * higher hit rate when engaging multiple rocks at close range.
 */
function aggressiveFireWindow(
  rockSize: 0 | 1 | 2,
  interceptDist: number
): number {
  const r = rockRadius(rockSize)
  const dist = Math.max(interceptDist, 0.001)
  return Math.max(0.15, (r / dist) * 2.5)
}

/** Check if we should fire: any rock currently aligned. */
function shouldFire(
  analyses: RockAnalysis[],
  engineYawInBearing: number,
  canFire: boolean
): boolean {
  if (!canFire) return false
  // Aggressive: Fire if ANY rock is in a generous forward cone or aligned with lead
  for (const a of analyses) {
    if (a.arcDist > EFFECTIVE_RANGE) continue

    // Check lead alignment
    const relLead = relativeBearing(a.leadBearing, engineYawInBearing)
    if (Math.abs(relLead) <= aggressiveFireWindow(a.rock.size, a.interceptDist))
      return true

    // Check current position alignment (opportunistic spray)
    if (Math.abs(a.relBearing) < 0.4) return true
  }
  return false
}

// ── Agent ──────────────────────────────────────────────────────────────

export const seekDestroyAgent: AgentFn = (state, playerId, context) => {
  const noOp = { left: false, right: false, thrust: false, fire: false }

  const player = state.players.get(playerId)
  if (player == null) return noOp
  const ship =
    player.shipId != null ? state.ships.get(player.shipId) : undefined
  if (ship == null || !ship.alive) return noOp

  const mem = getMemory(context)
  mem.tick += 1

  const canFire = elapsed(state, ship.firedAt) >= FIRE_COOLDOWN
  const shipSpeed = ship.angularVelocity.length()

  // CRITICAL: The engine's yaw 0 is East (PI/2), while sphericalBearing 0 is North.
  const engineYawInBearing = yawToBearing(ship.yaw)

  // ── Analyze all rocks ──────────────────────────────────────────────

  const analyses: RockAnalysis[] = []
  let worstThreat: RockAnalysis | null = null
  let worstThreatLevel = 0

  for (const rock of state.rocks.values()) {
    const arcDist = greatCircleDistance(
      ship.lat,
      ship.lng,
      rock.lat,
      rock.lng,
      RADIUS
    )
    const closingSpeed = computeClosingSpeed(ship.lat, ship.lng, rock)
    const ttc = computeTTC(arcDist, closingSpeed, collisionRadius(rock.size))
    const threatLevel = computeThreatLevel(ttc, rock.size)

    // Lead aim calculation
    const { bearing: leadBearing, interceptDist } = computeLeadAim(
      ship.lat,
      ship.lng,
      rock,
      shipSpeed
    )

    // Relative bearing to current position (for evasion logic)
    const absBearing = sphericalBearing(ship.lat, ship.lng, rock.lat, rock.lng)
    const relBearing = relativeBearing(absBearing, engineYawInBearing)

    const analysis: RockAnalysis = {
      rock: { id: rock.id, size: rock.size },
      arcDist,
      closingSpeed,
      ttc,
      threatLevel,
      relBearing,
      leadBearing,
      interceptDist,
    }
    analyses.push(analysis)

    if (threatLevel > worstThreatLevel) {
      worstThreat = analysis
      worstThreatLevel = threatLevel
    }
  }

  // ── Threat assessment ──────────────────────────────────────────────

  const EVADE_TTC_THRESHOLD = 0.6 // Even more aggressive, wait longer
  const URGENT_TTC_THRESHOLD = 0.3

  const isDangerous =
    worstThreat != null && worstThreat.ttc < EVADE_TTC_THRESHOLD
  const isUrgent = worstThreat != null && worstThreat.ttc < URGENT_TTC_THRESHOLD

  // ── Target selection ───────────────────────────────────────────────

  let bestTarget: RockAnalysis | null = null
  let bestTargetScore = Number.POSITIVE_INFINITY

  for (const a of analyses) {
    const relLead = relativeBearing(a.leadBearing, engineYawInBearing)
    const angularOffset = Math.abs(relLead)

    // Scoring for target prioritization
    const inRange = a.arcDist <= EFFECTIVE_RANGE
    const rangePenalty = inRange ? 0 : 2.0 // Strong preference for in-range
    const stickiness = a.rock.id === mem.lastTargetId ? -0.8 : 0

    const score =
      angularOffset + (a.arcDist / RADIUS) * 0.2 + rangePenalty + stickiness

    if (score < bestTargetScore) {
      bestTarget = a
      bestTargetScore = score
    }
  }

  // ── Decision Making ────────────────────────────────────────────────

  let targetBearing: number
  let thrust = false
  const fire = shouldFire(analyses, engineYawInBearing, canFire)

  // Determine if we should be evading or targeting
  // If we are already shooting at something, only evade if it is extremely urgent
  const shouldEvade = isUrgent || (isDangerous && !fire)

  if (shouldEvade && worstThreat) {
    mem.mode = 'evade'
    // Turn 90 degrees away from threat
    const evadeDir = worstThreat.relBearing > 0 ? -1 : 1
    targetBearing =
      worstThreat.relBearing + (Math.PI / 2) * evadeDir + engineYawInBearing
    thrust = true
  } else if (bestTarget) {
    mem.mode = 'engage'
    mem.lastTargetId = bestTarget.rock.id
    targetBearing = bestTarget.leadBearing

    // Speed up engagement: fast enough to close distance
    thrust = shipSpeed < MAX_SPEED * 0.6
  } else {
    mem.mode = 'hunt'
    targetBearing = engineYawInBearing
    thrust = shipSpeed < MAX_SPEED * 0.3
  }

  // ── Execute movement ───────────────────────────────────────────────

  const finalRelBearing = relativeBearing(targetBearing, engineYawInBearing)
  const steer = steerToward(finalRelBearing)

  return {
    ...steer,
    thrust,
    fire,
  }
}
