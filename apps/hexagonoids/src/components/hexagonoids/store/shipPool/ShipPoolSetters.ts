import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'
import { unwrap } from 'solid-js/store'

import type { ShipStore } from '../ship/ShipStore'

import { releaseShipStore } from './ShipPool'
import type { ShipPoolStore } from './ShipPoolStore'

interface ShipPoolSetters {
  add: OmitFirstArg<typeof addShip>
  remove: OmitFirstArg<typeof removeShip>
  clear: OmitFirstArg<typeof clearShips>
}

export const bindShipPoolSetters = (
  $shipPool: ShipPoolStore
): ShipPoolSetters => ({
  add: action($shipPool, 'add', addShip),
  remove: action($shipPool, 'remove', removeShip),
  clear: action($shipPool, 'clear', clearShips),
})

export const addShip = ($ships: ShipPoolStore, $ship: ShipStore) => {
  const id = $ship.get().id

  if (id === undefined) {
    console.warn('Cannot add ship without an id')
    return
  }
  const $prevShip = $ships.get()[id]

  if ($ship === $prevShip) {
    return
  }

  $ships.setKey(id, $ship)
}

export const removeShip = ($ships: ShipPoolStore, $ship: ShipStore) => {
  const id = $ship.get().id

  if (id === undefined) {
    throw new Error('Cannot remove ship without an id')
  }

  // remove from active ships
  $ships.setKey(id, undefined)

  // release back into the pool
  releaseShipStore(unwrap($ship))
}

export const clearShips = ($ships: ShipPoolStore) => {
  for (const $ship of Object.values($ships.get())) {
    if ($ship == null) {
      continue
    }
    removeShip($ships, $ship)
  }
}
