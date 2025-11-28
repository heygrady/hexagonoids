import {
  checkState,
  getInitialBoard,
  neatAI,
  type Board,
  type Player,
} from '@heygrady/tictactoe-game'
import type { SyncExecutor } from '@neat-evolution/executor'

export type BoardChangedCallback = (board: Board) => void
export type MovePlayedCallback = (board: Board, move: number) => void
export type StatusChangedCallback = (status: {
  player1Wins: boolean
  player2Wins: boolean
  gameOver: boolean
}) => void

/**
 * Interactive TicTacToe game.
 * Allows human player to play against an AI executor.
 */
export class InteractiveGame {
  private currentBoard: Board = getInitialBoard()
  private currentPlayer: Player = 1
  private gameOver: boolean = false
  private humanPlayer: Player = -1 // AI goes first
  private aiExecutor: SyncExecutor | null = null

  private readonly onBoardChangedListeners = new Set<BoardChangedCallback>()
  private readonly onMovePlayedListeners = new Set<MovePlayedCallback>()
  private readonly onStatusChangedListeners = new Set<StatusChangedCallback>()

  private _resolveGame: ((value?: void | PromiseLike<void>) => void) | null =
    null

  /**
   * Set the AI executor to be used for the game.
   * @param {SyncExecutor} executor - The AI executor
   */
  public setAIExecutor(executor: SyncExecutor) {
    this.aiExecutor = executor
  }

  public switchStartingPlayer() {
    this.humanPlayer = (this.humanPlayer * -1) as Player
  }

  /**
   * Reset starting player to AI going first.
   */
  public resetStartingPlayer(): void {
    this.humanPlayer = -1
  }

  /**
   * Get the human player's token.
   * @returns {Player} The human player (1 or -1)
   */
  public getHumanPlayerToken(): Player {
    return this.humanPlayer
  }

  /**
   * Check if it's currently the human player's turn.
   * @returns {boolean} True if it's the human's turn
   */
  public isHumanTurn(): boolean {
    return !this.gameOver && this.currentPlayer === this.humanPlayer
  }

  /**
   * Make a move on the board (called by human player via UI).
   * @param {number} index - The board position (0-8)
   */
  public move(index: number): void {
    if (this.gameOver) {
      console.warn('Game is over, cannot make move')
      return
    }

    if (this.currentBoard[index] !== 0) {
      console.warn('Invalid move: square already occupied')
      return
    }

    // Apply human move
    const newBoard = [...this.currentBoard] as Board
    newBoard[index] = this.currentPlayer
    this.currentBoard = newBoard

    // Notify listeners
    for (const listener of this.onBoardChangedListeners) {
      listener(this.currentBoard)
    }
    for (const listener of this.onMovePlayedListeners) {
      listener(this.currentBoard, index)
    }

    // Check if game ended
    const [isWin, isDraw, winner] = checkState(this.currentBoard)
    if (isWin || isDraw) {
      this.endGame(isWin, isDraw, winner)
      return
    }

    // Switch to AI player
    this.currentPlayer = (this.currentPlayer * -1) as Player

    // Make AI move after a short delay for UI responsiveness
    setTimeout(() => {
      this.makeAIMove()
    }, 20)
  }

  /**
   * Make an AI move using the current executor.
   */
  private makeAIMove(): void {
    if (this.gameOver) return

    if (this.aiExecutor == null) {
      console.warn('No AI executor set, cannot make move')
      return
    }

    const [newBoard, move] = neatAI(this.currentBoard, this.currentPlayer, {
      executor: this.aiExecutor,
    })
    this.currentBoard = newBoard

    // Notify listeners
    for (const listener of this.onBoardChangedListeners) {
      listener(this.currentBoard)
    }
    for (const listener of this.onMovePlayedListeners) {
      listener(this.currentBoard, move)
    }

    // Check if game ended
    const [isWin, isDraw, winner] = checkState(this.currentBoard)
    if (isWin || isDraw) {
      this.endGame(isWin, isDraw, winner)
      return
    }

    // Switch back to human player
    this.currentPlayer = (this.currentPlayer * -1) as Player
  }

  /**
   * End the current game and notify listeners.
   * @param {boolean} isWin - Whether the game ended in a win
   * @param {boolean} _isDraw - Whether the game ended in a draw
   * @param {Player | null} winner - The winning player (1 or -1), or null if draw
   */
  private endGame(
    isWin: boolean,
    _isDraw: boolean,
    winner: Player | null
  ): void {
    this.gameOver = true

    for (const listener of this.onStatusChangedListeners) {
      listener({
        player1Wins: isWin && winner === this.humanPlayer,
        player2Wins: isWin && winner === this.humanPlayer * -1,
        gameOver: true,
      })
    }

    if (this._resolveGame !== null) {
      this._resolveGame()
      this._resolveGame = null
    }
  }

  /**
   * Start a new game.
   */
  public async play(): Promise<void> {
    await new Promise((resolve) => {
      this._resolveGame = resolve
      this.currentBoard = getInitialBoard()
      this.currentPlayer = 1
      this.gameOver = false

      // Notify listeners of initial board
      for (const listener of this.onBoardChangedListeners) {
        listener(this.currentBoard)
      }

      // If AI goes first, make a move
      if (this.humanPlayer === -1) {
        setTimeout(() => {
          this.makeAIMove()
        }, 20)
      }
    })
  }

  /**
   * Force-stop the current game in progress.
   * Resolves the play() promise and ends the game as a draw.
   */
  public stopGame(): void {
    if (this._resolveGame !== null && !this.gameOver) {
      this.endGame(false, true, null)
    } else if (this._resolveGame !== null) {
      // Game is already over but promise not resolved - force resolve
      this._resolveGame()
      this._resolveGame = null
    }
  }

  /**
   * Register callback for board changes.
   * @param {BoardChangedCallback} listener - Callback to invoke when board changes
   */
  public onBoardChanged = (listener: BoardChangedCallback): void => {
    this.onBoardChangedListeners.add(listener)
  }

  /**
   * Unregister callback for board changes.
   * @param {BoardChangedCallback} listener - Callback to remove
   */
  public offBoardChanged = (listener: BoardChangedCallback): void => {
    this.onBoardChangedListeners.delete(listener)
  }

  /**
   * Register callback for moves played.
   * @param {MovePlayedCallback} listener - Callback to invoke when a move is played
   */
  public onMovePlayed = (listener: MovePlayedCallback): void => {
    this.onMovePlayedListeners.add(listener)
  }

  /**
   * Unregister callback for moves played.
   * @param {MovePlayedCallback} listener - Callback to remove
   */
  public offMovePlayed = (listener: MovePlayedCallback): void => {
    this.onMovePlayedListeners.delete(listener)
  }

  /**
   * Register callback for status changes (game end).
   * @param {StatusChangedCallback} listener - Callback to invoke when game status changes
   */
  public onStatusChanged = (listener: StatusChangedCallback): void => {
    this.onStatusChangedListeners.add(listener)
  }

  /**
   * Unregister callback for status changes.
   * @param {StatusChangedCallback} listener - Callback to remove
   */
  public offStatusChanged = (listener: StatusChangedCallback): void => {
    this.onStatusChangedListeners.delete(listener)
  }
}
