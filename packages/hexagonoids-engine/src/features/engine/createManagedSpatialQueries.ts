import {
  buildSpatialIndex,
  latLngToSpatialPoint,
  type SpatialIndex,
  type SpatialPoint,
  type SpatialRockEntity,
} from '../spatial-index/index.js'
import {
  RADIUS,
  ROCK_LARGE_RADIUS,
  ROCK_MEDIUM_RADIUS,
  ROCK_SMALL_RADIUS,
} from './constants.js'
import type { GameState } from './types.js'

function pointFromPosition(position: {
  x?: number
  y?: number
  z?: number
  lat: number
  lng: number
}): SpatialPoint {
  if (position.x != null && position.y != null && position.z != null) {
    return {
      x: position.x,
      y: position.y,
      z: position.z,
    }
  }
  return latLngToSpatialPoint(position.lat, position.lng)
}

function dot(a: SpatialPoint, b: SpatialPoint): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function matchesRadius(
  position: {
    x?: number
    y?: number
    z?: number
    lat: number
    lng: number
  },
  center: SpatialPoint,
  minDot: number
): SpatialPoint | null {
  const point = pointFromPosition(position)
  return dot(point, center) >= minDot ? point : null
}

export interface ManagedSpatialQueries {
  getSpatialIndex: () => SpatialIndex
  invalidateSpatialIndex: () => void
  queryRocksNear: (center: SpatialPoint, radius: number) => SpatialRockEntity[]
  countRocksNear: (center: SpatialPoint, radius: number) => number
  hasRocksNear: (center: SpatialPoint, radius: number) => boolean
  findFirstRockIntersect: (
    center: SpatialPoint,
    radius: number
  ) => SpatialRockEntity | undefined
}

export function createManagedSpatialQueries(
  getState: () => GameState
): ManagedSpatialQueries {
  let spatialIndex: SpatialIndex | null = null

  function getSpatialIndex(): SpatialIndex {
    if (spatialIndex == null) {
      spatialIndex = buildSpatialIndex(getState())
    }
    return spatialIndex
  }

  function minDotForRadius(radius: number): number {
    return Math.cos(radius / RADIUS)
  }

  return {
    getSpatialIndex,
    invalidateSpatialIndex(): void {
      spatialIndex = null
    },
    queryRocksNear(center: SpatialPoint, radius: number): SpatialRockEntity[] {
      const minDot = minDotForRadius(radius)
      const results: SpatialRockEntity[] = []
      for (const rock of getState().rocks.values()) {
        const point = matchesRadius(rock, center, minDot)
        if (point != null) {
          results.push({
            id: rock.id,
            type: 'rock',
            point,
            entity: rock,
          })
        }
      }
      return results
    },
    countRocksNear(center: SpatialPoint, radius: number): number {
      const minDot = minDotForRadius(radius)
      let count = 0
      for (const rock of getState().rocks.values()) {
        if (matchesRadius(rock, center, minDot) != null) {
          count += 1
        }
      }
      return count
    },
    hasRocksNear(center: SpatialPoint, radius: number): boolean {
      const minDot = minDotForRadius(radius)
      for (const rock of getState().rocks.values()) {
        if (matchesRadius(rock, center, minDot) != null) {
          return true
        }
      }
      return false
    },
    findFirstRockIntersect(
      center: SpatialPoint,
      radius: number
    ): SpatialRockEntity | undefined {
      const smallDot = minDotForRadius(radius + ROCK_SMALL_RADIUS)
      const mediumDot = minDotForRadius(radius + ROCK_MEDIUM_RADIUS)
      const largeDot = minDotForRadius(radius + ROCK_LARGE_RADIUS)

      for (const rock of getState().rocks.values()) {
        const point = pointFromPosition(rock)
        const thresholdDot =
          rock.size === 2 ? largeDot : rock.size === 1 ? mediumDot : smallDot
        if (dot(point, center) >= thresholdDot) {
          return {
            id: rock.id,
            type: 'rock',
            point,
            entity: rock,
          }
        }
      }
      return undefined
    },
  }
}
