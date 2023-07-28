import { useContext } from 'solid-js'

import { GameContext } from '../GameContext'

export const useGame = () => {
  const context = useContext(GameContext)
  if (context == null) {
    throw new Error('useGame: cannot find a GameContext.Provider')
  }
  return context
}
