import { describe, expect, test } from 'vitest'

import { boardToKey, keyToBoard, type Board } from '../src/board/ticTacToe.js'

describe('boardToKey', () => {
  test('boardToKey -> keyToBoard', () => {
    const board: Board = [1, 0, -1, 0, 1, -1, -1, 0, 1]
    const key = boardToKey(board)
    expect(key).toBe(8173)
    const decodedBoard = keyToBoard(key)
    expect(decodedBoard).toEqual(board)
  })
})
