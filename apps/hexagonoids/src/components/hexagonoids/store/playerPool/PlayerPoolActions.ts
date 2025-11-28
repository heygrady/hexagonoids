import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import type { PlayerStore } from '../player/PlayerStore'

import { getPlayerStore } from './PlayerPool'
import { addPlayer } from './PlayerPoolSetters'
import type { PlayerPoolStore } from './PlayerPoolStore'

export interface PlayerPoolActions {
  generatePlayer: OmitFirstArg<typeof generatePlayer>
}

export const bindPlayerPoolActions = (
  $players: PlayerPoolStore
): PlayerPoolActions => ({
  generatePlayer: action($players, 'generatePlayer', generatePlayer),
})

/**
 * Generates a new player
 * @param {PlayerPoolStore} $players - set of active players
 * @returns {PlayerStore} the player that was generated
 */
export const generatePlayer = ($players: PlayerPoolStore) => {
  // Get a clean player from the pool
  const $player = getPlayerStore()

  // // Initialize the player
  // startPlayer($player, $ships, scene)

  // Add the player to the active players
  addPlayer($players, $player)

  return $player
}
