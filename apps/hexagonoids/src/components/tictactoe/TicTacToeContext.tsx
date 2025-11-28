import { createContext } from 'solid-js'

import type { GameActions } from './stores/game/GameActions.js'
import type { GameStore } from './stores/game/GameStore.js'

export const TicTacToeContext =
  createContext<[$game: GameStore, gameAction: GameActions]>()
