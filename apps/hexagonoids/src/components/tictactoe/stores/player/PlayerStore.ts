import { type MapStore, map } from 'nanostores'

import {
  defaultPlayerState,
  type PlayerState,
  type PlayerToken,
} from './PlayerState.js'

export type PlayerStore = MapStore<PlayerState>

export const createPlayerStore = (token: PlayerToken): PlayerStore => {
  return map<PlayerState>({ ...defaultPlayerState, token })
}
