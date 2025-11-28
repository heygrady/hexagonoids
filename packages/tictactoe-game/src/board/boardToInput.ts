import { reorientBoard, type TransformFunc } from './reorientBoard.js'
import type { Board, Player } from './ticTacToe.js'

export function boardToInput(
  board: Board,
  player: Player
): [number[], TransformFunc] {
  const myPieces: Board = board.map((p) => (p === player ? 1 : 0)) as Board
  const opponentPieces: Board = board.map((p) =>
    p === -player ? 1 : 0
  ) as Board
  const [transformedOpponentPieces, inverseTransform, transform] =
    reorientBoard(opponentPieces)
  const transformedMyPieces = transform(myPieces)
  return [
    [...transformedMyPieces, ...transformedOpponentPieces],
    inverseTransform,
  ]
}

// export function boardToInput(
//   board: Board,
//   player: Player
// ): [number[], TransformFunc] {
//   const myPieces: Board = board.map((p) => (p === player ? 1 : 0)) as Board
//   const opponentPieces: Board = board.map((p) =>
//     p === -player ? 1 : 0
//   ) as Board

//   return [[...myPieces, ...opponentPieces], (board: number[]) => board]
// }
