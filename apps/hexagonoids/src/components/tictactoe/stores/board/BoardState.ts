import type { PlayerToken } from '../player/PlayerState.js'

export interface BoardState {
  size: number
  cells: Array<PlayerToken | null>
}

export const defaultBoardState: BoardState = {
  size: 3, // default to a 3x3 board
  cells: Array(9).fill(null), // for a 3x3 board
}
