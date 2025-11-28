import { useContext } from 'solid-js'

import { TicTacToeContext } from '../TicTacToeContext.js'

export const useGame = () => {
  const context = useContext(TicTacToeContext)
  if (context == null) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}
