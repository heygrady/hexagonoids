import { describe, expect, test } from 'vitest'

import { TicTacToeBoard } from '../src/TicTacToeBoard.js'

describe('TicTacToeBoard', () => {
  test('should identify a win for player 1', () => {
    const board = new TicTacToeBoard(3)
    board.set(0, 1)
    board.set(4, -1)
    board.set(1, 1)
    board.set(5, -1)
    board.set(2, 1)
    const status = board.getStatus()
    expect(status).toEqual({
      player1Wins: true,
      player2Wins: false,
      gameOver: true,
    })
  })

  test('should identify a win for player 2', () => {
    const board = new TicTacToeBoard(3)
    board.set(4, 1)
    board.set(0, -1)
    board.set(5, 1)
    board.set(1, -1)
    board.set(6, 1)
    board.set(2, -1)
    const status = board.getStatus()
    expect(status).toEqual({
      player1Wins: false,
      player2Wins: true,
      gameOver: true,
    })
  })

  test('should identify an early draw', () => {
    const board = new TicTacToeBoard(3)
    board.set(6, 1)
    board.set(7, -1)
    board.set(8, 1)
    board.set(5, -1)
    board.set(4, 1)
    board.set(0, -1)
    board.set(1, 1)
    board.set(2, -1)
    const status = board.getStatus()
    expect(status).toEqual({
      player1Wins: false,
      player2Wins: false,
      gameOver: true,
    })
  })

  test('should identify a draw when no more moves are possible', () => {
    const board = new TicTacToeBoard(3)
    board.set(0, 1)
    board.set(1, -1)
    board.set(2, 1)
    board.set(3, -1)
    board.set(4, 1)
    board.set(5, -1)
    board.set(6, 1)
    board.set(7, -1)
    board.set(8, 1)
    const status = board.getStatus()
    expect(status).toEqual({
      player1Wins: false,
      player2Wins: false,
      gameOver: true,
    })
  })

  test('should throw when game is an early draw', () => {
    const board = new TicTacToeBoard(3)
    board.set(6, 1)
    board.set(7, -1)
    board.set(8, 1)
    board.set(5, -1)
    board.set(4, 1)
    board.set(0, -1)
    board.set(1, 1)
    board.set(2, -1)
    // board.set(3, 1)
    expect(() => board.set(3, 1)).toThrow()
  })

  test('should throw when game is an early win', () => {
    const board = new TicTacToeBoard(3)
    board.set(0, 1)
    board.set(4, -1)
    board.set(1, 1)
    board.set(5, -1)
    board.set(2, 1)
    expect(() => board.set(3, -1)).toThrow()
  })

  test('should throw when move is already made', () => {
    const board = new TicTacToeBoard(3)
    board.set(0, 1)
    board.set(4, -1)
    board.set(1, 1)
    board.set(5, -1)
    expect(() => board.set(5, 1)).toThrow()
  })

  test('should identify an ongoing game', () => {
    const board = new TicTacToeBoard(3)
    board.set(0, 1)
    board.set(1, -1)
    const status = board.getStatus()
    expect(status).toEqual({
      player1Wins: false,
      player2Wins: false,
      gameOver: false,
    })
  })

  test('should return the value of a space', () => {
    const board = new TicTacToeBoard(3)
    board.set(0, 1)
    expect(board.get(0)).toBe(1)
  })
})
