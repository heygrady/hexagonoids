import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import type { PlayerToken } from './PlayerState.js'
import type { PlayerStore } from './PlayerStore.js'

export interface PlayerSetters {
  setToken: OmitFirstArg<typeof setToken>
}

export const bindPlayerSetters = ($player: PlayerStore): PlayerSetters => ({
  setToken: action($player, 'setToken', setToken),
})

/**
 * Sets the token for a player.
 * @param {PlayerStore} $player - The player store.
 * @param {PlayerToken} token - The token to set ('X' or 'O').
 */
export const setToken = ($player: PlayerStore, token: PlayerToken) => {
  $player.setKey('token', token)
}
