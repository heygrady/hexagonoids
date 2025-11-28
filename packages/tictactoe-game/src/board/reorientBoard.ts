import QuickLRU from 'quick-lru'

import { boardToKey, type Board } from './ticTacToe.js'

type IndexBoard = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]
// We'll store both the canonical board and its mapping.
interface CanonicalBoardData {
  canonicalBoard: Board
  mapping: IndexBoard // mapping: original index → canonical index
}

const canonicalBoardCache = new QuickLRU<number, CanonicalBoardData>({
  maxSize: 10_000,
})

/**
 * Rotate the board 90° clockwise.
 * @param {Board} board - The board to rotate
 * @returns {Board} the rotated board
 */
export function rotateBoard90(board: Board): Board {
  const rotatedBoard = Array(9)
  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 3)
    const col = i % 3
    const newIndex = col * 3 + (2 - row)
    rotatedBoard[newIndex] = board[i]
  }
  return rotatedBoard as Board
}

/**
 * Reflect the board vertically.
 * @param {Board} board - The board to reflect
 * @returns {Board} the reflected board
 */
export function reflectBoardVertical(board: Board): Board {
  const reflectedBoard = Array(9)
  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 3)
    const col = i % 3
    const newIndex = row * 3 + (2 - col)
    reflectedBoard[newIndex] = board[i]
  }
  return reflectedBoard as Board
}

/**
 * Rotate an index 90° clockwise on a 3x3 board.
 * @param {number} i - The index to rotate
 * @returns {number} the rotated index
 */
function rotateIndex90(i: number): number {
  const row = Math.floor(i / 3)
  const col = i % 3
  return col * 3 + (2 - row)
}

/**
 * Reflect an index vertically on a 3x3 board.
 * @param {number} i - The index to reflect
 * @returns {number} the reflected index
 */
function reflectIndexVertical(i: number): number {
  const row = Math.floor(i / 3)
  const col = i % 3
  return row * 3 + (2 - col)
}

/**
 * Given a mapping array (of length 9) that maps each original board index
 * to its canonical index, compute its inverse mapping.
 * (That is, for each canonical index, return the original index.)
 * @param {IndexBoard} mapping - The mapping to invert
 * @returns {IndexBoard} the inverse mapping
 */
function invertMapping(mapping: IndexBoard): IndexBoard {
  const inv: IndexBoard = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  for (let i = 0; i < 9; i++) {
    inv[mapping[i] as number] = i
  }
  return inv
}

/**
 * Apply an inverse mapping to a prediction array.
 * That is, given predictions in canonical board order,
 * return predictions re-ordered to match the original board order.
 * @param {Board} arr - The array to transform
 * @param {IndexBoard} invMapping - The inverse mapping to apply
 * @returns {Board} the re-ordered array
 */
function applyTransform(arr: Board, invMapping: IndexBoard): Board {
  const res: Board = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  for (let i = 0; i < arr.length; i++) {
    res[invMapping[i] as number] = arr[i] as number
  }
  return res
}

export type TransformFunc = (pred: Board) => Board

/**
 * Reorient the board into its canonical rotation/reflection.
 *
 * Returns a tuple of:
 *  - the canonical board, and
 *  - a transform function that maps an array of predictions in canonical order
 *    back into the original board order.
 *
 * The function caches results keyed by the original board's key.
 * @param {Board} board the board to reorient
 * @returns {[Board, TransformFunc, TransformFunc]} the canonical board and transform function
 */
export function reorientBoard(
  board: Board
): [Board, TransformFunc, TransformFunc] {
  const initialBoardKey = boardToKey(board)
  if (canonicalBoardCache.has(initialBoardKey)) {
    const { canonicalBoard, mapping } = canonicalBoardCache.get(
      initialBoardKey
    ) as CanonicalBoardData
    const invMapping = invertMapping(mapping)
    return [
      canonicalBoard,
      (pred: Board) => applyTransform(pred, invMapping),
      (pred: Board) => applyTransform(pred, mapping),
    ]
  }

  // Start with the original board and an identity mapping.
  let bestBoard: Board = board.slice() as Board
  let bestMapping: IndexBoard = [0, 1, 2, 3, 4, 5, 6, 7, 8]
  let bestKey = boardToKey(bestBoard)

  let currentBoard: Board = board.slice() as Board
  let currentMapping: IndexBoard = [0, 1, 2, 3, 4, 5, 6, 7, 8]

  // Try all rotations and, after each rotation, also try a vertical reflection.
  for (let i = 0; i < 4; i++) {
    if (i > 0) {
      currentBoard = rotateBoard90(currentBoard)
      // Update mapping: newMapping[j] = rotateIndex90(previousMapping[j])
      currentMapping = currentMapping.map(rotateIndex90) as IndexBoard
    }
    const currentKey = boardToKey(currentBoard)
    if (currentKey < bestKey) {
      bestKey = currentKey
      bestBoard = currentBoard.slice() as Board
      bestMapping = currentMapping.slice() as IndexBoard
    }

    // Reflect the current board vertically.
    const reflectedBoard = reflectBoardVertical(currentBoard)
    const reflectedMapping = currentMapping.map(reflectIndexVertical)
    const reflectedKey = boardToKey(reflectedBoard)
    if (reflectedKey < bestKey) {
      bestKey = reflectedKey
      bestBoard = reflectedBoard.slice() as Board
      bestMapping = reflectedMapping.slice() as IndexBoard
    }
  }

  // Cache the computed canonical board and its mapping.
  canonicalBoardCache.set(initialBoardKey, {
    canonicalBoard: bestBoard,
    mapping: bestMapping,
  })
  const invMapping = invertMapping(bestMapping)
  return [
    bestBoard,
    (pred: Board) => applyTransform(pred, invMapping),
    (pred: Board) => applyTransform(pred, bestMapping),
  ]
}
