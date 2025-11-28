import type { Scene } from '@babylonjs/core/scene'
import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import {
  type BulletPoolActions,
  bindBulletPoolActions,
} from '../bulletPool/BulletPoolActions'
import {
  type CellPoolActions,
  bindCellPoolActions,
} from '../cellPool/CellPoolActions'
import { startPlayer } from '../player/PlayerActions'
import type { PlayerStore } from '../player/PlayerStore'
import {
  type PlayerPoolActions,
  bindPlayerPoolActions,
} from '../playerPool/PlayerPoolActions'
import {
  type RockPoolActions,
  bindRockPoolActions,
} from '../rockPool/RockPoolActions'
import {
  type ShipPoolActions,
  bindShipPoolActions,
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
