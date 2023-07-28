import { createContext } from 'solid-js'

import type { GameActions } from './store/game/GameActions'
import type { GameStore } from './store/game/GameStore'

export const GameContext =
  createContext<[$game: GameStore, actions: GameActions]>()
