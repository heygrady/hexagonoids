import { getOpportunities } from './getOpportunities.js'

export const chooseToWinBias = 10
export const chooseToBlockWinBias = 8
export const chooseOwnSpaceBias = 5
export const chooseToBlockBias = 2
export const chooseOpenSpaceBias = 2
export const avoidSettledSpaceBias = 5

export const scoreMove = (
  board: number[],
  boardSize: number,
  playerToken: 1 | -1,
  moveIndex: number
): number => {
  const opponentToken = -playerToken
  const opportunities = getOpportunities(boardSize)

  /** spaces that would win the game */
  const winningSpaces = new Set<number>()

  /** spaces that would block an opponent from winning the game */
  const blockingSpaces = new Set<number>()

  /** spaces in a set you control */
  const playerSpaces = new Set<number>()

  /** spaces in a set your opponent controls */
  const opponentSpaces = new Set<number>()

  /** spaces no one controls */
  const openSpaces = new Set<number>()

  /** spaces both players control (already blocked) */
  const settledSpaces = new Set<number>()

  for (const opportunity of opportunities) {
    let playerTokenCount = 0
    let opponentTokenCount = 0
    const spaceIndex: number[] = []
    for (const index of opportunity) {
      if (board[index] === playerToken) {
        playerTokenCount++
      } else if (board[index] === opponentToken) {
        opponentTokenCount++
      } else {
        spaceIndex.push(index)
      }
    }
    if (playerTokenCount === boardSize - 1 && spaceIndex.length === 1) {
      winningSpaces.add(spaceIndex[0] as number)
    } else if (
      opponentTokenCount === boardSize - 1 &&
      spaceIndex.length === 1
    ) {
      blockingSpaces.add(spaceIndex[0] as number)
    } else if (
      spaceIndex.length > 0 &&
      playerTokenCount > 1 &&
      opponentTokenCount > 1
    ) {
      for (const i of spaceIndex) {
        settledSpaces.add(i)
      }
    } else if (
      spaceIndex.length > 0 &&
      playerTokenCount > 1 &&
      opponentTokenCount === 0
    ) {
      for (const i of spaceIndex) {
        playerSpaces.add(i)
      }
    } else if (
      spaceIndex.length > 0 &&
      playerTokenCount === 0 &&
      opponentTokenCount > 1
    ) {
      for (const i of spaceIndex) {
        opponentSpaces.add(i)
      }
    } else if (spaceIndex.length === boardSize) {
      for (const i of spaceIndex) {
        openSpaces.add(i)
      }
    }
  }

  let score = 0

  if (winningSpaces.has(moveIndex)) {
    score += chooseToWinBias
  } else if (winningSpaces.size > 0) {
    score -= chooseToWinBias
  }
  if (blockingSpaces.has(moveIndex)) {
    score += chooseToBlockWinBias
  } else if (blockingSpaces.size > 0) {
    score -= chooseToBlockWinBias
  }
  if (playerSpaces.has(moveIndex)) {
    score += chooseOwnSpaceBias
  }
  if (opponentSpaces.has(moveIndex)) {
    score += chooseToBlockBias
  }
  if (openSpaces.has(moveIndex)) {
    score += chooseOpenSpaceBias
  }
  const betterOptionsExist =
    winningSpaces.size > 1 ||
    blockingSpaces.size > 1 ||
    playerSpaces.size > 1 ||
    opponentSpaces.size > 1 ||
    openSpaces.size > 1
  if (settledSpaces.has(moveIndex) && betterOptionsExist) {
    score -= avoidSettledSpaceBias
  }
  return score
}
