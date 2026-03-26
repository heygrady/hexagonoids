/**
 * Fire-time bullet intercept reward for RL reward shaping.
 *
 * When a bullet is fired, simulates it forward against every rock using the
 * engine's own physics (integrateAngularVelocity + quatToUnitPoint). Tracks
 * the minimum angular distance to any rock center across the bullet's full
 * lifetime, then scores with an easeOutQuad taper from dead center (1.0) to
 * ROCK_LARGE_RADIUS (0.0).
 *
 * This gives the agent immediate credit for a well-aimed shot at the moment
 * of the fire action — the best signal for PPO credit assignment.
 *
 * Performance: rock trajectories are precomputed once per tick and reused
 * across all newly fired bullets, avoiding redundant physics simulation.
 */
import {
  BULLET_LIFETIME,
  BULLET_RADIUS,
  BULLET_TRAVEL_DISTANCE,
  type GameState,
  integrateAngularVelocity,
  type Quat,
  quat,
  quatToUnitPoint,
  ROCK_LARGE_RADIUS,
  ROCK_MEDIUM_RADIUS,
  ROCK_SMALL_RADIUS,
  type ShipState,
  type Vec3,
  vec3,
} from '@heygrady/hexagonoids-engine'

import type { RewardConfig } from './simulateGame.js'

// ── Constants ────────────────────────────────────────────────────────────────

/** Collision thresholds per rock size: cos((BULLET_RADIUS + rockRadius) / RADIUS).
 *  RADIUS = 5 (sphere radius). Pre-computed for collision detection. */
const SPHERE_RADIUS = 5
const COLLISION_DOT_SMALL = Math.cos(
  (BULLET_RADIUS + ROCK_SMALL_RADIUS) / SPHERE_RADIUS
)
const COLLISION_DOT_MEDIUM = Math.cos(
  (BULLET_RADIUS + ROCK_MEDIUM_RADIUS) / SPHERE_RADIUS
)
const COLLISION_DOT_LARGE = Math.cos(
  (BULLET_RADIUS + ROCK_LARGE_RADIUS) / SPHERE_RADIUS
)

/** Taper boundary for aim scoring (angular distance in unit-sphere coords). */
const AIM_TAPER_RADIUS = ROCK_LARGE_RADIUS

/** Distance beyond the taper at which a miss scores the full demerit (-1).
 *  Uses bullet travel distance — if nothing was in range, the shot was pointless. */
const MISS_FAR_DISTANCE = BULLET_TRAVEL_DISTANCE

// ── Scratch buffers (pre-allocated, reused across calls) ─────────────────────

const _bulletOri: Quat = quat(0, 0, 0, 1)
const _bulletPos: Vec3 = vec3(0, 0, 0)
const _rockOri: Quat = quat(0, 0, 0, 1)

// ── Rock trajectory cache ────────────────────────────────────────────────────

/** Maximum number of simulation steps (BULLET_LIFETIME / minDtMs). */
const MAX_STEPS = 128

/** Maximum rocks to cache trajectories for. */
const MAX_ROCKS = 64

/**
 * Pre-allocated flat buffer for rock positions across all steps.
 * Layout: rockIndex * MAX_STEPS * 3 + step * 3 + {0,1,2}
 */
const _rockPositions = new Float64Array(MAX_ROCKS * MAX_STEPS * 3)

/** Collision dot thresholds per cached rock. */
const _rockCollisionDots = new Float64Array(MAX_ROCKS)

// ── Core ─────────────────────────────────────────────────────────────────────

/**
 * Compute the fire-time aim reward for all newly fired bullets.
 * Called only when `deltas.newBullets > 0`.
 *
 * Returns the total reward to add to this tick's reward sum.
 */
export function computeFireTimeAimReward(
  state: GameState,
  ship: ShipState,
  config: RewardConfig,
  dtMs: number,
  episodeStartTime?: number
): number {
  if (config.bulletAimReward === 0) return 0
  if (state.rocks.size === 0) return 0

  const steps = Math.ceil(BULLET_LIFETIME / dtMs)
  const dtS = dtMs / 1000
  const clampedSteps = Math.min(steps, MAX_STEPS)

  // Precompute rock trajectories — done once, reused for every bullet
  const rockCount = precomputeRockTrajectories(state, clampedSteps, dtS)
  if (rockCount === 0) return 0

  let totalReward = 0

  for (const bullet of state.bullets.values()) {
    if (bullet.ownerId !== ship.id) continue
    if (bullet.firedAt == null) continue

    // Only score newly fired bullets (firedAt within current tick)
    if (bullet.firedAt < state.now) continue

    // Skip pre-existing bullets from before the episode started
    if (episodeStartTime != null && bullet.firedAt <= episodeStartTime) continue

    const aimScore = scoreBulletAgainstRocks(
      bullet.orientation,
      bullet.position,
      bullet.angularVelocity,
      rockCount,
      clampedSteps,
      dtS
    )

    if (aimScore > 0) {
      totalReward += config.bulletAimReward * aimScore
    } else if (aimScore < 0 && config.bulletMissDemerit > 0) {
      // aimScore is in [-1, 0) for misses — scale by demerit coefficient
      totalReward += config.bulletMissDemerit * aimScore
    }
  }

  return totalReward
}

/**
 * Precompute the trajectory (unit-sphere positions) for every rock in the
 * current game state. Stores results in the flat `_rockPositions` buffer
 * and collision thresholds in `_rockCollisionDots`.
 *
 * Returns the number of rocks cached (clamped to MAX_ROCKS).
 */
function precomputeRockTrajectories(
  state: GameState,
  steps: number,
  dtS: number
): number {
  let rockIdx = 0
  for (const rock of state.rocks.values()) {
    if (rockIdx >= MAX_ROCKS) break

    // Store collision threshold for this rock
    _rockCollisionDots[rockIdx] =
      rock.size === 2
        ? COLLISION_DOT_LARGE
        : rock.size === 1
          ? COLLISION_DOT_MEDIUM
          : COLLISION_DOT_SMALL

    // Copy rock orientation into scratch
    _rockOri[0] = rock.orientation[0]
    _rockOri[1] = rock.orientation[1]
    _rockOri[2] = rock.orientation[2]
    _rockOri[3] = rock.orientation[3]

    const base = rockIdx * MAX_STEPS * 3

    for (let i = 0; i < steps; i++) {
      integrateAngularVelocity(_rockOri, rock.angularVelocity, dtS)
      // Inline quatToUnitPoint to write directly into flat buffer
      // quatToUnitPoint rotates local (0,1,0) by q:
      //   x = 2*(qx*qy - qz*qw)
      //   y = 1 - 2*(qx*qx + qz*qz)
      //   z = 2*(qy*qz + qx*qw)
      const qx = _rockOri[0]
      const qy = _rockOri[1]
      const qz = _rockOri[2]
      const qw = _rockOri[3]
      const offset = base + i * 3
      _rockPositions[offset] = 2 * (qx * qy - qz * qw)
      _rockPositions[offset + 1] = 1 - 2 * (qx * qx + qz * qz)
      _rockPositions[offset + 2] = 2 * (qy * qz + qx * qw)
    }

    rockIdx++
  }

  return rockIdx
}

/**
 * Score a single bullet against all precomputed rock trajectories.
 *
 * Returns:
 *  - Positive [0, 1]: aimed shot — 1.0 dead center, 0 at large rock edge
 *  - Negative [-1, 0): miss — 0 at large rock edge, -1 when very far from any rock
 */
function scoreBulletAgainstRocks(
  bulletOrientation: Quat,
  bulletPosition: Vec3,
  bulletVelocity: Vec3,
  rockCount: number,
  steps: number,
  dtS: number
): number {
  // Copy bullet state into scratch
  _bulletOri[0] = bulletOrientation[0]
  _bulletOri[1] = bulletOrientation[1]
  _bulletOri[2] = bulletOrientation[2]
  _bulletOri[3] = bulletOrientation[3]
  _bulletPos[0] = bulletPosition[0]
  _bulletPos[1] = bulletPosition[1]
  _bulletPos[2] = bulletPosition[2]

  let bestMinDist = Infinity

  for (let i = 0; i < steps; i++) {
    // Step bullet forward
    integrateAngularVelocity(_bulletOri, bulletVelocity, dtS)
    quatToUnitPoint(_bulletPos, _bulletOri)

    const bx = _bulletPos[0]
    const by = _bulletPos[1]
    const bz = _bulletPos[2]

    // Check against all precomputed rock positions at this step
    for (let r = 0; r < rockCount; r++) {
      const offset = r * MAX_STEPS * 3 + i * 3
      const rx = _rockPositions[offset] as number
      const ry = _rockPositions[offset + 1] as number
      const rz = _rockPositions[offset + 2] as number

      const dot = bx * rx + by * ry + bz * rz

      // Check for actual collision (confirmed kill)
      if (dot >= (_rockCollisionDots[r] as number)) {
        return 0 // dead center — distance 0
      }

      // Angular distance to rock center
      const angDist = Math.acos(Math.min(1, Math.max(-1, dot)))
      if (angDist < bestMinDist) {
        bestMinDist = angDist
      }
    }
  }

  if (bestMinDist < AIM_TAPER_RADIUS) {
    // Hit or near-hit — easeOutQuad taper: 1.0 at center, 0.0 at large edge
    const t = 1 - bestMinDist / AIM_TAPER_RADIUS
    return t * (2 - t) // easeOutQuad
  }

  // Miss — linear ramp from 0 (just missed) to -1 (far from any rock)
  const overshoot = bestMinDist - AIM_TAPER_RADIUS
  return -Math.min(1, overshoot / MISS_FAR_DISTANCE)
}
