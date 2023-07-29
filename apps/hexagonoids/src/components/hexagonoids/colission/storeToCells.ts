import { BoundingSphere, Vector3 } from '@babylonjs/core'
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

// FIXME: this should use the real mesh shape
export const storeToRadius = ($store: TargetStore | ProjectileStore) => {
  const radius = isRockStore($store)
    ? $store.get().size === ROCK_LARGE_SIZE
      ? ROCK_LARGE_RADIUS
      : $store.get().size === ROCK_MEDIUM_SIZE
      ? ROCK_MEDIUM_RADIUS
      : ROCK_SMALL_RADIUS
    : isShipStore($store)
    ? SHIP_RADIUS
    : BULLET_RADIUS
  return radius
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

    // get a disk of cells
    const disk = getGridDisk(h, k)
    disk.delete(h)
    for (const h of disk) {
      const diskBoundingSphere = cellToBoundingSphere(h)
      if (BoundingSphere.Intersects(diskBoundingSphere, storeBoundingSphere)) {
        cells.add(h)
      }
    }
  }

  if (state.id != null) {
    storeCellsCache.set(key, cells)
  }
  return cells
}
