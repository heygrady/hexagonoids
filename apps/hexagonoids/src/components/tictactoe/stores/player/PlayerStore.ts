import { map, type MapStore } from 'nanostores'

import {
  defaultPlayerState,
  type PlayerToken,
  type PlayerState,
} from './PlayerState.js'

export type PlayerStore = MapStore<PlayerState>

export const createPlayerStore = (token: PlayerToken): PlayerStore => {
  return map<PlayerState>({ ...defaultPlayerState, token })
}
