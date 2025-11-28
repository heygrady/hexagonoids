import QuickLRU from 'quick-lru'

export type Player = 1 | -1
export type Board = [
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
export type Line = [number, number, number]
export type GameState = [isWin: boolean, isDraw: boolean, winner: Player | null]

export function getInitialBoard(): Board {
  return Array(9).fill(0) as Board
}

export function boardToKey(board: Board): number {
  let key = 0
  for (let i = 0; i < board.length; i++) {
    const square = board[i] as number
    // Map -1 to 2, then use base‑3 encoding.
    key = key * 3 + (square === -1 ? 2 : square)
  }
  return key
}

export function keyToBoard(key: number): Board {
  const board: number[] = new Array(9)
  // Fill the board array from the least significant digit (last position) to the first.
  for (let i = 8; i >= 0; i--) {
    const digit = key % 3
    board[i] = digit === 2 ? -1 : digit // Convert digit 2 back to -1.
    key = Math.floor(key / 3)
  }
  return board as Board
}

export function getWinningLines(): Line[] {
  return [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ]
}

const stateCache = new QuickLRU<number, GameState>({ maxSize: 10_000 })

export function checkState(board: Board): GameState {
  const key = boardToKey(board)

  if (stateCache.has(key)) {
    return stateCache.get(key) as GameState
  }

  const winningLines = getWinningLines()
  let isBoardFull = true
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 0) {
      isBoardFull = false
      break
    }
  }

  let allLinesConflicted = true
  for (const line of winningLines) {
    const [a, b, c] = line
    const first = board[a]
    // Check for a win.
    if (first !== 0 && board[b] === first && board[c] === first) {
      const state: GameState = [true, false, first as Player]
      stateCache.set(key, state)
      return state
    }

    // Determine if the line is conflicted.
    let hasX = false
    let hasO = false
    for (const index of line) {
      const square = board[index]
      if (square === 1) {
        hasX = true
      } else if (square === -1) {
        hasO = true
      }
    }
    if (!(hasX && hasO)) {
      allLinesConflicted = false
    }
  }

  if (isBoardFull || allLinesConflicted) {
    const state: GameState = [false, true, null]
    stateCache.set(key, state)
    return state
  }

  const state: GameState = [false, false, null]
  stateCache.set(key, state)
  return state
}

export function getValidMoves(board: Board): number[] {
  const validMoves: number[] = []
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 0) {
      validMoves.push(i)
    }
  }
  return validMoves
}

interface CandidateMoves {
  winningMoves: number[]
  blockingMoves: number[]
  developingRows: number[] // Horizontal rows (lines 0-2)
  developingColumns: number[] // Vertical columns (lines 3-5)
  developingDiagonals: number[] // Diagonals (lines 6-7)
  openMoves: number[]
}

const candidateCache = new QuickLRU<number, CandidateMoves>({ maxSize: 10_000 })

/**
 * Returns candidate moves for the given board and player.
 * It checks each winning line once, and collects:
 * - winningMoves: if a line has exactly two player's marks and one empty cell.
 * - blockingMoves: if a line has exactly two opponent's marks and one empty cell.
 * - developingRows: if a horizontal row isn't conflicted and has at least one player's mark.
 * - developingColumns: if a vertical column isn't conflicted and has at least one player's mark.
 * - developingDiagonals: if a diagonal isn't conflicted and has at least one player's mark.
 * - openMoves: if the line is completely empty.
 * @param {Board} board - The board to analyze
 * @param {Player} player - The player to find moves for
 * @returns {CandidateMoves} the candidate moves
 */
export function getCandidateMoves(
  board: Board,
  player: Player
): CandidateMoves {
  const key = boardToKey(board) * player
  if (candidateCache.has(key)) {
    return candidateCache.get(key) as CandidateMoves
  }
  const winningLines = getWinningLines()
  const opponent: Player = player === 1 ? -1 : 1
  const winningMoves = new Set<number>()
  const blockingMoves = new Set<number>()
  const developingRows = new Set<number>()
  const developingColumns = new Set<number>()
  const developingDiagonals = new Set<number>()
  const openMoves = new Set<number>()

  for (let lineIndex = 0; lineIndex < winningLines.length; lineIndex++) {
    const line = winningLines[lineIndex] as Line
    let playerCount = 0
    let opponentCount = 0
    const emptyIndices: number[] = []
    for (const index of line) {
      const cell = board[index]
      if (cell === player) {
        playerCount++
      } else if (cell === opponent) {
        opponentCount++
      } else {
        emptyIndices.push(index)
      }
    }

    // Winning candidate: two player's marks and one empty.
    if (playerCount === 2 && emptyIndices.length === 1) {
      winningMoves.add(emptyIndices[0] as number)
    }
    // Blocking candidate: two opponent's marks and one empty.
    if (opponentCount === 2 && emptyIndices.length === 1) {
      blockingMoves.add(emptyIndices[0] as number)
    }
    // Developing candidate: if the line isn't conflicted (contains only one kind of mark)
    // and has at least one player's mark, then each empty square is a candidate.
    // Categorize by line type: rows (0-2), columns (3-5), diagonals (6-7)
    if (opponentCount === 0 && playerCount > 0 && emptyIndices.length > 0) {
      const targetSet =
        lineIndex < 3
          ? developingRows // Rows (lines 0-2)
          : lineIndex < 6
          ? developingColumns // Columns (lines 3-5)
          : developingDiagonals // Diagonals (lines 6-7)
      for (const i of emptyIndices) {
        targetSet.add(i)
      }
    }
    // Open move: if the line is completely empty.
    if (playerCount === 0 && opponentCount === 0) {
      for (const i of line) {
        openMoves.add(i)
      }
    }
  }
  const candidates: CandidateMoves = {
    winningMoves: Array.from(winningMoves),
    blockingMoves: Array.from(blockingMoves),
    developingRows: Array.from(developingRows),
    developingColumns: Array.from(developingColumns),
    developingDiagonals: Array.from(developingDiagonals),
    openMoves: Array.from(openMoves),
  }
  candidateCache.set(key, candidates)
  return candidates
}

export interface ForkingCandidateMoves extends CandidateMoves {
  forkingMoves: number[] // Moves that create a fork (2+ simultaneous threats)
  blockingForkMoves: number[] // Moves that block an opponent's fork
}

/**
 * A lightweight, non-cached helper to find *only* immediate winning moves.
 * Used internally by getCandidateMoves for fork detection.
 * @param {Board} board - The board to analyze
 * @param {Player} player - The player to find winning moves for
 * @returns {number[]} the winning moves
 */
function _findWinningMoves(board: Board, player: Player): number[] {
  const winningLines = getWinningLines()
  const winningMoves = new Set<number>()

  for (const line of winningLines) {
    let playerCount = 0
    const emptyIndices: number[] = []
    let opponentPresent = false // Add this flag for a clean break

    for (const index of line) {
      const cell = board[index]
      if (cell === player) {
        playerCount++
      } else if (cell === 0) {
        emptyIndices.push(index)
      } else {
        // It's an opponent
        opponentPresent = true
        break // This line can't be a win, move to next line
      }
    }

    // A win requires exactly 2 player marks, 1 empty spot, and 0 opponent marks.
    if (!opponentPresent && playerCount === 2 && emptyIndices.length === 1) {
      winningMoves.add(emptyIndices[0] as number)
    }
  }
  return Array.from(winningMoves)
}

/**
 * Returns candidate moves for the given board and player, including fork analysis.
 * This extends getCandidateMoves() with 2-ply fork detection:
 * - forkingMoves (2-ply): if a move creates two or more simultaneous winning threats.
 * - blockingForkMoves (2-ply): if a move would block an opponent's fork.
 * All other categories (winningMoves, blockingMoves, developing*, openMoves) come from getCandidateMoves().
 * @param {Board} board - The board to analyze
 * @param {Player} player - The player to find moves for
 * @returns {ForkingCandidateMoves} the candidate moves with fork analysis
 */
export function getForkingCandidateMoves(
  board: Board,
  player: Player
): ForkingCandidateMoves {
  const key = boardToKey(board) * player + 1_000_000 // Differentiate from non-forking cache
  if (candidateCache.has(key)) {
    return candidateCache.get(key) as ForkingCandidateMoves
  }

  // Get base candidate moves (1-ply analysis)
  const baseCandidates = getCandidateMoves(board, player)

  // --- 2-PLY FORK ANALYSIS ---
  const opponent: Player = player === 1 ? -1 : 1
  const forkingMoves = new Set<number>()
  const blockingForkMoves = new Set<number>()
  const validMoves = getValidMoves(board)

  // Create ONE temporary board for all simulations
  const tempBoard = [...board] as Board

  for (const move of validMoves) {
    // Check for *my* fork:
    // What if I play here?
    tempBoard[move] = player // Mutate temp board
    const myResultingWins = _findWinningMoves(tempBoard, player)
    if (myResultingWins.length >= 2) {
      forkingMoves.add(move)
    }
    // No need to revert, will be overwritten

    // Check for *opponent's* fork (to block):
    // What if the *opponent* plays here?
    tempBoard[move] = opponent // Mutate temp board again
    const opponentResultingWins = _findWinningMoves(tempBoard, opponent)
    if (opponentResultingWins.length >= 2) {
      // If this move is a fork for them, then playing here
      // is a "blocking fork" move for me.
      blockingForkMoves.add(move)
    }

    // Revert the mutation for the next loop iteration
    tempBoard[move] = 0
  }

  const candidates: ForkingCandidateMoves = {
    ...baseCandidates, // Spread all base fields
    forkingMoves: Array.from(forkingMoves),
    blockingForkMoves: Array.from(blockingForkMoves),
  }
  candidateCache.set(key, candidates)
  return candidates
}
