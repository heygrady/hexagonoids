import {
  buildSpatialIndex,
  type SpatialIndex,
  type SpatialPoint,
  type SpatialRockEntity,
} from '../spatial-index/index.js'
import type { GameState } from './types.js'

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

  return {
    getSpatialIndex,
    invalidateSpatialIndex(): void {
      spatialIndex = null
    },
    queryRocksNear(center: SpatialPoint, radius: number): SpatialRockEntity[] {
      return getSpatialIndex().queryRocksNear(center, radius)
    },
    countRocksNear(center: SpatialPoint, radius: number): number {
      return getSpatialIndex().queryRocksNear(center, radius).length
    },
    hasRocksNear(center: SpatialPoint, radius: number): boolean {
      return getSpatialIndex().queryRocksNear(center, radius).length > 0
    },
    findFirstRockIntersect(
      center: SpatialPoint,
      radius: number
    ): SpatialRockEntity | undefined {
      return getSpatialIndex().findFirstRockIntersect(center, radius)
    },
  }
}
