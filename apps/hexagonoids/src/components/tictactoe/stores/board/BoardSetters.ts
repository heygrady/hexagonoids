import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import type { PlayerToken } from '../player/PlayerState.js'

import type { BoardStore } from './BoardStore.js'

export interface BoardSetters {
  setCell: OmitFirstArg<typeof setCell>
  resetBoard: OmitFirstArg<typeof resetBoard>
  updateBoard: OmitFirstArg<typeof updateBoard>
}

export const bindBoardSetters = ($board: BoardStore): BoardSetters => ({
  setCell: action($board, 'setCell', setCell),
  resetBoard: action($board, 'resetBoard', resetBoard),
  updateBoard: action($board, 'updateBoard', updateBoard),
})

export const setCell = (
  $board: BoardStore,
  index: number,
  token: PlayerToken | null
) => {
  const cells = [...$board.get().cells]
  if (index < 0 || index >= cells.length) {
    throw new Error('Invalid cell index')
  }
  if (cells[index] !== null) {
    throw new Error('Cell is already occupied')
  }
  cells[index] = token
  $board.setKey('cells', cells)
}

export const resetBoard = ($board: BoardStore) => {
  const size = $board.get().size
  $board.setKey('cells', Array(size * size).fill(null))
}

export const updateBoard = (
  $board: BoardStore,
  cells: Array<PlayerToken | null>
) => {
  $board.setKey('cells', cells)
}
