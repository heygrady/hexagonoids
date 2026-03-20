import {
  RADIUS,
  ROCK_LARGE_RADIUS,
  ROCK_MEDIUM_RADIUS,
  ROCK_SMALL_RADIUS,
} from './constants.js'
import type { Vec3 } from './math/types.js'
import { vec3Dot } from './math/vec3.js'
import type { GameState, RockState } from './types.js'

// Pre-computed dot-product thresholds for per-size rock intersection.
// cos(arc_distance / sphere_radius) where arc_distance = queryRadius + rockRadius.
function computeRockIntersectThresholds(queryRadius: number) {
  return {
    smallDot: Math.cos((queryRadius + ROCK_SMALL_RADIUS) / RADIUS),
    mediumDot: Math.cos((queryRadius + ROCK_MEDIUM_RADIUS) / RADIUS),
    largeDot: Math.cos((queryRadius + ROCK_LARGE_RADIUS) / RADIUS),
  }
}

export interface ManagedSpatialQueries {
  /** All rocks within angular distance `radius / RADIUS` of center. */
  queryRocksNear: (center: Vec3, radius: number) => RockState[]
  /** Count of rocks within angular distance. */
  countRocksNear: (center: Vec3, radius: number) => number
  /** Is any rock within angular distance? (early exit) */
  hasRocksNear: (center: Vec3, radius: number) => boolean
  /** First rock whose bounding sphere intersects a sphere at center with given radius. Accounts for per-size rock radii. */
  findFirstRockIntersect: (
    center: Vec3,
    radius: number
  ) => RockState | undefined
}

/**
 * Direct rock queries on game state. All queries use dot-product filtering
 * on state.rocks — no intermediate SpatialIndex or wrapper allocations.
 *
 * With typically 4-20 rocks, linear scan is optimal.
 */
export function createManagedSpatialQueries(
  getState: () => GameState
): ManagedSpatialQueries {
  return {
    queryRocksNear(center: Vec3, radius: number): RockState[] {
      const state = getState()
      const minDot = Math.cos(radius / RADIUS)
      const results: RockState[] = []
      for (const rock of state.rocks.values()) {
        if (vec3Dot(rock.position, center) >= minDot) {
          results.push(rock)
        }
      }
      return results
    },

    countRocksNear(center: Vec3, radius: number): number {
      const state = getState()
      const minDot = Math.cos(radius / RADIUS)
      let count = 0
      for (const rock of state.rocks.values()) {
        if (vec3Dot(rock.position, center) >= minDot) {
          count++
        }
      }
      return count
    },

    hasRocksNear(center: Vec3, radius: number): boolean {
      const state = getState()
      const minDot = Math.cos(radius / RADIUS)
      for (const rock of state.rocks.values()) {
        if (vec3Dot(rock.position, center) >= minDot) {
          return true
        }
      }
      return false
    },

    findFirstRockIntersect(
      center: Vec3,
      radius: number
    ): RockState | undefined {
      const state = getState()
      const { smallDot, mediumDot, largeDot } =
        computeRockIntersectThresholds(radius)
      for (const rock of state.rocks.values()) {
        const thresholdDot =
          rock.size === 2 ? largeDot : rock.size === 1 ? mediumDot : smallDot
        if (vec3Dot(rock.position, center) >= thresholdDot) {
          return rock
        }
      }
      return undefined
    },
  }
}
