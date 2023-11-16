export type SpaceValue = 1 | 0 | -1
export type PlayerToken = 1 | -1

export interface BoardStatus {
  player1Wins: boolean
  player2Wins: boolean
  gameOver: boolean
}

enum GroupStatus {
  Draw = 0,
  Undecided = 2,
}

export class TicTacToeBoard {
  public readonly boardSize: number
  public readonly board: SpaceValue[]
  public readonly inverseBoard: SpaceValue[]

  public readonly status: BoardStatus

  private movesMade: number
  private drawCount: number
  private readonly maxMoves: number
  private readonly maxDraws: number
  private readonly groupStatus: Map<string, GroupStatus>

  private readonly rowSums: number[]
  private readonly colSums: number[]
  private readonly diagSums: number[]
  private readonly playerTokensInRows: Array<Set<PlayerToken>>
  private readonly playerTokensInCols: Array<Set<PlayerToken>>
  private readonly playerTokensInDiags: Array<Set<PlayerToken>>

  constructor(boardSize: number) {
    this.boardSize = boardSize
    this.board = Array(boardSize * boardSize).fill(0)
    this.inverseBoard = Array(boardSize * boardSize).fill(0)
    this.status = {
      player1Wins: false,
      player2Wins: false,
      gameOver: false,
    }

    this.movesMade = 0
    this.drawCount = 0
    this.maxMoves = boardSize * boardSize
    this.maxDraws = boardSize * 2 + 2
    this.groupStatus = new Map()

    this.rowSums = new Array(boardSize).fill(0)
    this.colSums = new Array(boardSize).fill(0)
    this.diagSums = [0, 0]

    this.playerTokensInRows = Array.from(
      { length: boardSize },
      () => new Set<PlayerToken>()
    )
    this.playerTokensInCols = Array.from(
      { length: boardSize },
      () => new Set<PlayerToken>()
    )
    this.playerTokensInDiags = Array.from(
      { length: 2 },
      () => new Set<PlayerToken>()
    )
  }

  clear() {
    this.board.fill(0)
    this.inverseBoard.fill(0)
    this.status.player1Wins = false
    this.status.player2Wins = false
    this.status.gameOver = false
    this.movesMade = 0
    this.drawCount = 0
    this.groupStatus.clear()
    this.rowSums.fill(0)
    this.colSums.fill(0)
    this.diagSums.fill(0)
    this.playerTokensInRows.forEach((set) => {
      set.clear()
    })
    this.playerTokensInCols.forEach((set) => {
      set.clear()
    })
    this.playerTokensInDiags.forEach((set) => {
      set.clear()
    })
  }

  set(index: number, player: PlayerToken) {
    const row = Math.floor(index / this.boardSize)
    const col = index % this.boardSize

    if (this.board[index] !== 0) {
      throw new Error('Cannot set value of non-empty space')
    }
    if (this.status.gameOver) {
      throw new Error('Cannot set value of space on a finished board')
    }

    this.board[index] = player
    this.inverseBoard[index] = (player * -1) as PlayerToken
    this.movesMade++

    // Update row, column, and diagonal status
    this.rowSums[row] += player
    this.colSums[col] += player

    const rowKey = `row${row}`
    const rowStatus = this.groupStatus.get(rowKey) ?? 2
    const colKey = `col${col}`
    const colStatus = this.groupStatus.get(colKey) ?? 2

    if (rowStatus === 2) {
      this.playerTokensInRows[row]?.add(player)
    }
    if (colStatus === 2) {
      this.playerTokensInCols[col]?.add(player)
    }
    if (this.playerTokensInRows[row]?.size === 2 && rowStatus === 2) {
      this.drawCount++
      this.groupStatus.set(rowKey, 0)
    }
    if (this.playerTokensInCols[col]?.size === 2 && colStatus === 2) {
      this.drawCount++
      this.groupStatus.set(colKey, 0)
    }
    if (row === col) {
      this.diagSums[0] += player
      const diagKey = 'diag0'
      const diagStatus = this.groupStatus.get(diagKey) ?? 2
      if (diagStatus === 2) {
        this.playerTokensInDiags[0]?.add(player)
      }
      if (this.playerTokensInDiags[0]?.size === 2 && diagStatus === 2) {
        this.drawCount++
        this.groupStatus.set(diagKey, 0)
      }
    }
    if (row === this.boardSize - col - 1) {
      this.diagSums[1] += player
      this.playerTokensInDiags[1]?.add(player)
      const diagKey = 'diag1'
      const diagStatus = this.groupStatus.get(diagKey) ?? 2
      if (diagStatus === 2) {
        this.playerTokensInDiags[1]?.add(player)
      }
      if (this.playerTokensInDiags[1]?.size === 2 && diagStatus === 2) {
        this.drawCount++
        this.groupStatus.set(diagKey, 0)
      }
    }

    // Check for a win
    if (this.rowSums[row] === this.boardSize * player) {
      if (player === 1) {
        this.status.player1Wins = true
      } else {
        this.status.player2Wins = true
      }
      this.status.gameOver = true
    }

    // Check for a draw
    if (this.drawCount === this.maxDraws || this.movesMade === this.maxMoves) {
      this.status.gameOver = true
    }
  }

  get(index: number): SpaceValue | undefined {
    return this.board[index]
  }

  getStatus(): BoardStatus {
    return this.status
  }
}
