import type { Scene } from '@babylonjs/core/scene'
import { action } from 'nanostores'
import type { OmitFirstArg } from '../../../../types/nanostores.js'

import {
  type BulletPoolActions,
  bindBulletPoolActions,
} from '../bulletPool/BulletPoolActions'
import {
  bindCellPoolActions,
  type CellPoolActions,
} from '../cellPool/CellPoolActions'
import { startPlayer } from '../player/PlayerActions'
import type { PlayerStore } from '../player/PlayerStore'
import {
  bindPlayerPoolActions,
  type PlayerPoolActions,
} from '../playerPool/PlayerPoolActions'
import {
  bindRockPoolActions,
  type RockPoolActions,
} from '../rockPool/RockPoolActions'
import {
  bindShipPoolActions,
  type ShipPoolActions,
} from '../shipPool/ShipPoolActions'

import { setEndedAt, setPlayer, setStartedAt } from './GameSetters'
import type { GameStore } from './GameStore'

export interface GameActions {
  start: OmitFirstArg<typeof startGame>
  end: OmitFirstArg<typeof endGame>
  bullets: BulletPoolActions
  rocks: RockPoolActions
  ships: ShipPoolActions
  cells: CellPoolActions
  players: PlayerPoolActions
}

export const bindGameActions = ($game: GameStore): GameActions => {
  const gameState = $game.get()
  return {
    start: action($game, 'start', startGame),
    end: action($game, 'end', endGame),
    bullets: bindBulletPoolActions(gameState.$bullets),
    rocks: bindRockPoolActions(gameState.$rocks),
    ships: bindShipPoolActions(gameState.$ships),
    cells: bindCellPoolActions(gameState.$cells),
    players: bindPlayerPoolActions(gameState.$players),
  }
}

export const startGame = (
  $game: GameStore,
  $player: PlayerStore,
  scene: Scene
) => {
  setPlayer($game, $player)

  startPlayer($player, $game.get().$ships, scene)

  setStartedAt($game)
}

export const endGame = ($game: GameStore) => {
  setEndedAt($game)
}
