import { map, type MapStore } from 'nanostores'

import type { BoardState } from './BoardState.js'

export type BoardStore = MapStore<BoardState>

export const createBoardStore = (size: number): BoardStore => {
  if (size < 3) {
    throw new Error('Board size must be at least 3')
  }
  const state: BoardState = {
    size,
    cells: Array(size * size).fill(null),
  }
  return map<BoardState>(state)
}
