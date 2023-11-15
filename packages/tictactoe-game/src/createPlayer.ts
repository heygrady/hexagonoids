import type { Executor, SyncExecutor } from '@neat-evolution/executor'

import type { SpaceValue } from './TicTacToeBoard.js'

export type WeightedIndex = [index: number, weight: number]

export type PlayerFn = (board: SpaceValue[]) => WeightedIndex
export type AsyncPlayerFn = (board: SpaceValue[]) => Promise<WeightedIndex>

/** prefer outputs that are valid */
const validAttemptsBias = 10

export const toBoardIndex = (
  board: number[],
  output: number[]
): WeightedIndex => {
  let index: number | undefined
  let i = 0
  // find the first valid move
  while (i < output.length) {
    index = output.indexOf(Math.max(...output))
    if (board[index] === 0) {
      let attemptBias = 0
      if (i < output.length / 3) {
        attemptBias = (output.length - i) * validAttemptsBias
      } else if (i > output.length - output.length / 3) {
        attemptBias = i * validAttemptsBias * -1
      }
      return [index, attemptBias]
    }
    output[index] = -Infinity
    i++
  }
  return [-1, -1]
}

const encodeBoard = (board: number[]): number[] => {
  // convert each space to a 3 bit value
  const encodedBoard: number[] = []
  for (let i = 0; i < board.length; i++) {
    const value = board[i]
    const encodedValue =
      value === 0 ? [0, 1, 0] : value === 1 ? [1, 0, 0] : [0, 0, 1]
    encodedBoard.push(...encodedValue)
  }
  return encodedBoard
}

export const createPlayer = (executor: SyncExecutor): PlayerFn => {
  return (board: number[]): WeightedIndex => {
    const output = executor.execute(encodeBoard(board))
    return toBoardIndex(board, output)
  }
}

export const createAsyncPlayer = (executor: Executor): AsyncPlayerFn => {
  return async (board: number[]): Promise<WeightedIndex> => {
    const output = await executor.execute(encodeBoard(board))
    return toBoardIndex(board, output)
  }
}
