import { map, type MapStore } from 'nanostores'

import type { ShipPoolState } from './ShipPoolState'

export type ShipPoolStore = MapStore<ShipPoolState>

export const createShipPoolStore = (): ShipPoolStore => {
  const $ships = map<ShipPoolState>({})

  return $ships
}
