import { expect, test, describe } from 'vitest'

import { reorientBoard } from '../src/board/reorientBoard.js'
import type { Board } from '../src/board/ticTacToe.js'

describe('reorientBoard', () => {
  test('nw corner', () => {
    const board: Board = [1, 0, 0, 0, 0, 0, 0, 0, 0]
    const [canonical, transform] = reorientBoard(board)
    expect(canonical).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1])
    expect(transform(canonical)).toEqual(board)
  })
  test('ne corner', () => {
    const board: Board = [0, 0, 1, 0, 0, 0, 0, 0, 0]
    const [canonical, transform] = reorientBoard(board)
    expect(canonical).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1])
    expect(transform(canonical)).toEqual(board)
  })
  test('sw corner', () => {
    const board: Board = [0, 0, 0, 0, 0, 0, 1, 0, 0]
    const [canonical, transform] = reorientBoard(board)
    expect(canonical).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1])
    expect(transform(canonical)).toEqual(board)
  })
  test('se corner', () => {
    const board: Board = [0, 0, 0, 0, 0, 0, 0, 0, 1]
    const [canonical, transform] = reorientBoard(board)
    expect(canonical).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1])
    expect(transform(canonical)).toEqual(board)
  })
  test('north center', () => {
    const board: Board = [0, 1, 0, 0, 0, 0, 0, 0, 0]
    const [canonical, transform] = reorientBoard(board)
    expect(canonical).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 0])
    expect(transform(canonical)).toEqual(board)
  })
  test('west center', () => {
    const board: Board = [0, 0, 0, 1, 0, 0, 0, 0, 0]
    const [canonical, transform] = reorientBoard(board)
    expect(canonical).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 0])
    expect(transform(canonical)).toEqual(board)
  })
  test('east center', () => {
    const board: Board = [0, 0, 0, 0, 0, 1, 0, 0, 0]
    const [canonical, transform] = reorientBoard(board)
    expect(canonical).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 0])
    expect(transform(canonical)).toEqual(board)
  })
  test('south center', () => {
    const board: Board = [0, 0, 0, 0, 0, 0, 0, 1, 0]
    const [canonical, transform] = reorientBoard(board)
    expect(canonical).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 0])
    expect(transform(canonical)).toEqual(board)
  })
  describe('two moves', () => {
    test('first two', () => {
      const board: Board = [1, -1, 0, 0, 0, 0, 0, 0, 0]
      const [canonical, transform] = reorientBoard(board)
      expect(canonical).toEqual([0, 0, 0, 0, 0, 0, 0, -1, 1])
      expect(transform(canonical)).toEqual(board)
    })
    test('second two', () => {
      const board: Board = [0, -1, 1, 0, 0, 0, 0, 0, 0]
      const [canonical, transform] = reorientBoard(board)
      expect(canonical).toEqual([0, 0, 0, 0, 0, 0, 0, -1, 1])
      expect(transform(canonical)).toEqual(board)
    })
    test('third two', () => {
      const board: Board = [0, 0, 1, 0, 0, -1, 0, 0, 0]
      const [canonical, transform] = reorientBoard(board)
      expect(canonical).toEqual([0, 0, 0, 0, 0, 0, 0, -1, 1])
      expect(transform(canonical)).toEqual(board)
    })
    test('fourth two', () => {
      const board: Board = [0, 0, 0, 0, 0, 0, 0, -1, 1]
      const [canonical, transform] = reorientBoard(board)
      expect(canonical).toEqual([0, 0, 0, 0, 0, 0, 0, -1, 1])
      expect(transform(canonical)).toEqual(board)
    })
    test('fifth two', () => {
      const board: Board = [0, 0, 0, 0, 0, 0, 1, -1, 0]
      const [canonical, transform] = reorientBoard(board)
      expect(canonical).toEqual([0, 0, 0, 0, 0, 0, 0, -1, 1])
      expect(transform(canonical)).toEqual(board)
    })
    test('sixth two', () => {
      const board: Board = [0, 0, 0, -1, 0, 0, 1, 0, 0]
      const [canonical, transform] = reorientBoard(board)
      expect(canonical).toEqual([0, 0, 0, 0, 0, 0, 0, -1, 1])
      expect(transform(canonical)).toEqual(board)
    })
    test('seventh two', () => {
      const board: Board = [1, 0, 0, -1, 0, 0, 0, 0, 0]
      const [canonical, transform] = reorientBoard(board)
      expect(canonical).toEqual([0, 0, 0, 0, 0, 0, 0, -1, 1])
      expect(transform(canonical)).toEqual(board)
    })
  })
})
