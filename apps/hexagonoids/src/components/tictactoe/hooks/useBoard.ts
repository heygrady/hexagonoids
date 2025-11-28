import { useStore } from '@nanostores/solid'

import {
  bindBoardSetters,
  type BoardSetters,
} from '../stores/board/BoardSetters.js'
import type { BoardStore } from '../stores/board/BoardStore'

import { useGame } from './useGame'

export const useBoard = (): [$board: BoardStore, actions: BoardSetters] => {
  const [$game] = useGame()
  const $board = $game.get().$board
  return [$board, bindBoardSetters($board)]
}

export const subscribeBoard = () => {
  const [$board] = useBoard()
  return useStore($board)
}
