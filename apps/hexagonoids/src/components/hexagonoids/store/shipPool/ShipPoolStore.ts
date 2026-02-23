import { type MapStore, map } from 'nanostores'

import type { ShipPoolState } from './ShipPoolState'

export type ShipPoolStore = MapStore<ShipPoolState>

export const createShipPoolStore = (): ShipPoolStore => {
  const $ships = map<ShipPoolState>({})

  return $ships
}
