import { BoundingSphere } from '@babylonjs/core/Culling/boundingSphere'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { latLngToVector3 } from '@heygrady/h3-babylon'
import { cellToBoundary, type CoordPair, gridDisk, latLngToCell } from 'h3-js'
import QuickLRU from 'quick-lru'

import {
  BULLET_RADIUS,
  CELL_CACHE_SIZE,
  RADIUS,
  ROCK_LARGE_RADIUS,
  ROCK_LARGE_SIZE,
  ROCK_MEDIUM_RADIUS,
  ROCK_MEDIUM_SIZE,
  ROCK_SMALL_RADIUS,
  SHIP_RADIUS,
} from '../constants'
import { boundingPoints } from '../sphereArenaCamera/SphereArenaCamera'
import { LoopGuard } from '../utils/performanceMonitor'

import {
  isRockState,
  isRockStore,
  isShipState,
  isShipStore,
  type ProjectileStore,
  type TargetStore,
} from './typeCheck'

export const storeCellsCache = new QuickLRU<string, Set<string>>({
  maxSize: CELL_CACHE_SIZE,
})

export const gridDiskCache = new QuickLRU<string, Set<string>>({
  maxSize: 842,
})

const getGridDisk = (h: string, k: number) => {
  const key = `${h}_${k}`
  if (gridDiskCache.has(key)) {
    return gridDiskCache.get(key) as Set<string>
  }
  const disk = new Set(gridDisk(h, k))
  gridDiskCache.set(key, disk)
  return disk
}

const cellToBoundingSphere = (
  h: string,
  cellBoundary?: CoordPair[]
): BoundingSphere => {
  const boundary = cellBoundary ?? cellToBoundary(h)

  const [min, max] = boundingPoints(
    boundary.map((coordPair) =>
      latLngToVector3(coordPair[0], coordPair[1], RADIUS)
    )
  )
  return new BoundingSphere(min, max)
}

const isSphereInside = (
  sphereA: BoundingSphere,
  sphereB: BoundingSphere
): boolean => {
  const distanceCenters = Vector3.Distance(sphereA.center, sphereB.center)

  return distanceCenters + sphereA.radius <= sphereB.radius
}

/**
 * Get collision radius for a store object.
 * Uses hardcoded radii for fast lookup (called frequently in collision detection).
 * @param {TargetStore | ProjectileStore} $store - The store object
 * @returns {number} The collision radius
 */
export const storeToRadius = ($store: TargetStore | ProjectileStore) => {
  const state = $store.get()

  if (isRockStore($store)) {
    return state.size === ROCK_LARGE_SIZE
      ? ROCK_LARGE_RADIUS
      : state.size === ROCK_MEDIUM_SIZE
        ? ROCK_MEDIUM_RADIUS
        : ROCK_SMALL_RADIUS
  } else if (isShipStore($store)) {
    return SHIP_RADIUS
  } else {
    return BULLET_RADIUS
  }
}

export const storeToCells = (
  $store: TargetStore | ProjectileStore,
  resolution: number,
  skipCache = false
): Set<string> => {
  const state = $store.get()
  const type = isRockState(state)
    ? 'rock'
    : isShipState(state)
      ? 'ship'
      : 'bullet'
  const centerH = latLngToCell(state.lat, state.lng, 2)
  const key = `${type}_${centerH}`

  if (!skipCache && storeCellsCache.has(key)) {
    return storeCellsCache.get(key) as Set<string>
  }

  const positionNode = isShipState(state)
    ? state.positionNode
    : isRockState(state)
      ? state.orientationNode
      : state.bulletNode

  if (positionNode == null) {
    return new Set()
  }

  const cells = new Set<string>()

  // add the center
  const { lat, lng } = state
  const center = latLngToVector3(lat, lng, RADIUS)
  const h = latLngToCell(lat, lng, resolution)
  cells.add(h)

  // check if the cell fully contains the object
  const radius = storeToRadius($store)
  const cellBoundary = cellToBoundary(h)

  const cellBoundingSphere = cellToBoundingSphere(h, cellBoundary)
  const storeBoundingSphere = BoundingSphere.CreateFromCenterAndRadius(
    center,
    radius
  )

  const fullyContained = isSphereInside(storeBoundingSphere, cellBoundingSphere)

  if (!fullyContained) {
    const k =
      radius < cellBoundingSphere.radius
        ? 1
        : Math.ceil(radius / cellBoundingSphere.radius)

    // Diagnostic: log if we're checking an unusually large disk
    if (k > 5) {
      console.warn(
        `[storeToCells] Large disk radius k=${k} for ${type} at ${h} (radius=${radius}, cellRadius=${cellBoundingSphere.radius})`
      )
    }

    // get a disk of cells
    const disk = getGridDisk(h, k)
    disk.delete(h)

    // Loop guard: prevent infinite loops in cell checking
    const loopGuard = new LoopGuard(
      `storeToCells-${type}-${h}`,
      disk.size + 100
    )

    // Fix: Use different variable name to avoid shadowing
    for (const cellId of disk) {
      loopGuard.check()
      const diskBoundingSphere = cellToBoundingSphere(cellId)
      if (BoundingSphere.Intersects(diskBoundingSphere, storeBoundingSphere)) {
        cells.add(cellId)
      }
    }

    // Diagnostic: log iteration count
    if (loopGuard.getIterations() > 50) {
      console.warn(
        `[storeToCells] Checked ${loopGuard.getIterations()} cells for ${type} at ${h}`
      )
    }
  }

  if (state.id != null) {
    storeCellsCache.set(key, cells)
  }
  return cells
}
