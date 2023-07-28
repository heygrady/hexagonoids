import QuickLRU from 'quick-lru'
import { createUniqueId } from 'solid-js'

import { ROCK_CACHE_SIZE } from '../../constants'
import { createShipStore, type ShipStore, resetShip } from '../ship/ShipStore'

export const shipPool = new QuickLRU<string, ShipStore>({
  maxSize: ROCK_CACHE_SIZE,
  onEviction(key, $ship) {
    // console.log('evicting ship', key)
    disposeShip($ship)
  },
})

const getOldestShip = () => {
  const oldestEntry = shipPool.entriesAscending().next().value
  if (oldestEntry === undefined) {
    return undefined
  }
  return oldestEntry[1] as ShipStore | undefined
}

/**
 * Retrieve a ship from the pool, or create a new one.
 * @param id
 * @returns
 */
export const getShipStore = () => {
  // get or create
  const $ship = getOldestShip() ?? createShipStore()

  const id = $ship.get().id
  if (id === undefined) {
    throw new Error('Ship id must be set')
  }

  // remove from pool; give a new id
  if (shipPool.has(id)) {
    shipPool.delete(id)
    $ship.setKey('id', createUniqueId())
  }

  return $ship
}

/**
 * Release a ship back into the pool.
 * @param $ship
 */
export const releaseShipStore = ($ship: ShipStore) => {
  const { id } = $ship.get()

  if (id === undefined) {
    throw new Error('Ship id must be set')
  }

  shipPool.set(id, resetShip($ship))
}

/**
 * Dispose of a ship.
 * @param $ship the ship to dispose
 */
export const disposeShip = ($ship: ShipStore) => {
  const { originNode, positionNode, orientationNode, shipNode } = $ship.get()

  // inside out
  shipNode?.material?.dispose(true, true)
  shipNode?.dispose(false, true)
  orientationNode?.dispose()
  positionNode?.dispose()
  originNode?.dispose()
}
