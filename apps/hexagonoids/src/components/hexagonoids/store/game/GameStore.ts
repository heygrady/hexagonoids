import { map, type MapStore } from 'nanostores'

import { createBulletPoolStore } from '../bulletPool/BulletPoolStore'
import { createCellPoolStore } from '../cellPool/CellPoolStore'
import { createPlayerPoolStore } from '../playerPool/PlayerPoolStore'
import { createRockPoolStore } from '../rockPool/RockPoolStore'
import { createShipPoolStore } from '../shipPool/ShipPoolStore'

import { defaultGameState, type GameState } from './GameState'

export type GameStore = MapStore<GameState>

export const createGameStore = (): GameStore => {
  const $bullets = createBulletPoolStore()
  const $rocks = createRockPoolStore()
  const $ships = createShipPoolStore()
  const $cells = createCellPoolStore()
  const $players = createPlayerPoolStore()

  const $game = map<GameState>({
    ...defaultGameState,
    $bullets,
    $rocks,
    $ships,
    $cells,
    $players,
    startedAt: null,
    endedAt: null,
  })

  return $game
}
