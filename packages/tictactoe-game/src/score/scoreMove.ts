import { getOpportunities } from './getOpportunities.js'

export const chooseToWinBias = 10
export const chooseToBlockWinBias = 8
export const chooseCenterSpaceBias = 6

export const chooseOwnSpaceBias = 5
export const chooseToBlockBias = 4

export const chooseOpenSpaceBias = 3

export const chooseCornerSpaceBias = 3
export const chooseDiagSpaceBias = 2
export const chooseEdgeSpaceBias = 1

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

  /** spaces in a set you control; grouped by how full it is */
  const playerSpaces: Record<number, Set<number>> = {}

  /** spaces in a set your opponent controls; grouped by how full it is */
  const opponentSpaces: Record<number, Set<number>> = {}

  /** spaces no one controls */
  const openSpaces = new Set<number>()

  /** spaces both players control (already blocked) */
  const settledSpaces = new Set<number>()

  // Search all rows, columns and diagonals
  for (const opportunity of opportunities.combinations) {
    // Inspect the opportunity
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

    // Categorize the opportunity
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
      if (playerSpaces[playerTokenCount] == null) {
        playerSpaces[playerTokenCount] = new Set<number>(spaceIndex)
      } else {
        const set = playerSpaces[playerTokenCount] as Set<number>
        for (const i of spaceIndex) {
          set.add(i)
        }
      }
    } else if (
      spaceIndex.length > 0 &&
      playerTokenCount === 0 &&
      opponentTokenCount > 1
    ) {
      if (opponentSpaces[opponentTokenCount] == null) {
        opponentSpaces[opponentTokenCount] = new Set<number>(spaceIndex)
      } else {
        const set = opponentSpaces[opponentTokenCount] as Set<number>
        for (const i of spaceIndex) {
          set.add(i)
        }
      }
    } else if (spaceIndex.length === boardSize) {
      for (const i of spaceIndex) {
        openSpaces.add(i)
      }
    }
  }

  let score = 0

  // Critical Moves
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
  if (opportunities.centerSpace === moveIndex) {
    score += chooseCenterSpaceBias
  } else if (
    board[opportunities.centerSpace] === 0 &&
    !winningSpaces.has(moveIndex) &&
    !blockingSpaces.has(moveIndex)
  ) {
    score -= chooseCenterSpaceBias
  }

  // Grow
  let hasPlayerSpace = false
  for (const set of Object.values(playerSpaces)) {
    if (set.has(moveIndex)) {
      score += chooseOwnSpaceBias * (set.size / (boardSize - 1))
    }
    hasPlayerSpace = true
  }
  if (openSpaces.has(moveIndex)) {
    score += chooseOpenSpaceBias
  }

  // Defend
  let hasOpponentSpace = false
  for (const set of Object.values(opponentSpaces)) {
    if (set.has(moveIndex)) {
      score += chooseToBlockBias * (set.size / (boardSize - 1))
    }
    hasOpponentSpace = true
  }

  // Control
  if (opportunities.corners.has(moveIndex)) {
    score += chooseCornerSpaceBias
  }
  if (opportunities.edges.has(moveIndex)) {
    score += chooseEdgeSpaceBias
  }
  if (opportunities.diagonals.has(moveIndex)) {
    score += chooseDiagSpaceBias
  }

  const betterOptionsExist =
    winningSpaces.size > 1 ||
    blockingSpaces.size > 1 ||
    hasPlayerSpace ||
    hasOpponentSpace ||
    openSpaces.size > 1
  if (settledSpaces.has(moveIndex) && betterOptionsExist) {
    score -= avoidSettledSpaceBias
  }
  return score
}
