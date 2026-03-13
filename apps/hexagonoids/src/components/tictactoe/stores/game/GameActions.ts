import { action } from 'nanostores'
import type { OmitFirstArg } from '../../../../types/nanostores.js'

import {
  disableAutoPlay,
  enableAutoPlay,
  end,
  move,
  restart,
  start,
  update,
} from './actions/index.js'
import type { GameStore } from './GameStore.js'

export interface GameActions {
  move: OmitFirstArg<typeof move>
  update: OmitFirstArg<typeof update>
  start: OmitFirstArg<typeof start>
  end: OmitFirstArg<typeof end>
  restart: OmitFirstArg<typeof restart>
  enableAutoPlay: OmitFirstArg<typeof enableAutoPlay>
  disableAutoPlay: OmitFirstArg<typeof disableAutoPlay>
}

export const bindGameActions = ($game: GameStore): GameActions => ({
  move: action($game, 'move', move),
  update: action($game, 'update', update),
  start: action($game, 'start', start),
  end: action($game, 'end', end),
  restart: action($game, 'restart', restart),
  enableAutoPlay: action($game, 'enableAutoPlay', enableAutoPlay),
  disableAutoPlay: action($game, 'disableAutoPlay', disableAutoPlay),
})
