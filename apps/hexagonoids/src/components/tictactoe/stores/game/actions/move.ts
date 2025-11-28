import { PlayerToken } from '../../player/PlayerState.js'
import { setStatus } from '../GameSetters.js'
import { GameStatus } from '../GameState.js'
import type { GameStore } from '../GameStore.js'

import { bindBoardSetters } from './shared.js'
import { start } from './start.js'

export const update = ($game: GameStore, board: number[]) => {
  const $board = $game.get().$board

  const newCells: Array<PlayerToken | null> = []
  for (let i = 0; i < board.length; i++) {
    newCells.push(
      board[i] === 1 ? PlayerToken.X : board[i] === -1 ? PlayerToken.O : null
    )
  }
  bindBoardSetters($board).updateBoard(newCells)
  setStatus($game, GameStatus.Waiting)
}

export const move = async ($game: GameStore, index: number) => {
  if ($game.get().status === GameStatus.Pending) {
    return
  }

  if ($game.get().status === GameStatus.NotStarted) {
    await start($game)
  }

  // Call InteractiveGame directly - callbacks will update UI
  $game.get().interactiveGame.move(index)
  setStatus($game, GameStatus.Pending)
}
