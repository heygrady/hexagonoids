import { useStore } from '@nanostores/solid'
import { For } from 'solid-js'
import type { Component } from 'solid-js'

import { Cell } from './Cell.js'
import { subscribeBoard } from './hooks/useBoard.js'
import { useGame } from './hooks/useGame.js'
import { subscribeSettings } from './hooks/useSettings.js'

export interface TicTacToeBoardProps {
  id?: string
}

export const TicTacToeBoard: Component<TicTacToeBoardProps> = (props) => {
  const [$game, gameActions] = useGame()
  const board = subscribeBoard()
  const game = useStore($game)
  const settings = subscribeSettings()

  const boardSize = 3 // Can be dynamically set to 3 or 5 later

  let movePromise: Promise<void> | null = null
  const handleCellClick = (index: number) => {
    if (movePromise !== null) {
      return
    }
    movePromise = gameActions.move(index).finally(() => {
      movePromise = null
    })
  }

  return (
    <div
      id={props.id}
      class='relative w-full'
      style={{ 'padding-bottom': '100%' }}
    >
      <div class='flex flex-wrap border-separate border-spacing-0 w-full absolute inset-0'>
        <For each={board().cells}>
          {(cell, index) => (
            <Cell
              cell={cell}
              index={index()}
              boardSize={boardSize}
              player1Emoji={settings().committed.player1Emoji}
              player2Emoji={settings().committed.player2Emoji}
              humanPlayerToken={game().humanPlayerToken}
              onClick={() => {
                if (cell === null) {
                  handleCellClick(index())
                }
              }}
            />
          )}
        </For>
      </div>

      {game().gameOutcome !== undefined && (
        <div class='absolute inset-0 bg-white/50 flex flex-col gap-4 items-center justify-center rounded'>
          <p class='text-6xl'>
            {game().gameOutcome === 'win'
              ? '🎉'
              : game().gameOutcome === 'loss'
                ? '🤖'
                : '🤝'}
          </p>
          <p class='text-lg font-semibold'>
            {game().gameOutcome === 'win'
              ? 'You win!'
              : game().gameOutcome === 'loss'
                ? 'AI wins!'
                : "It's a draw!"}
          </p>
        </div>
      )}

      {game().isWaitingForEvolution && (
        <div class='absolute inset-0 bg-white/80 flex flex-col gap-4 items-center justify-center rounded z-10'>
          <div class='flex flex-col items-center gap-2'>
            <span class='loading loading-spinner loading-lg text-primary' />
            <p class='text-lg font-bold text-base-content'>Training...</p>
          </div>
        </div>
      )}

      {game().operationStatus !== undefined && (
        <div class='absolute inset-0 bg-white/80 flex flex-col gap-4 items-center justify-center rounded z-10'>
          <div class='flex flex-col items-center gap-2'>
            <span class='loading loading-spinner loading-lg text-primary' />
            <p class='text-lg font-bold text-base-content'>
              {game().operationStatus === 'resetting'
                ? 'Resetting...'
                : 'Switching...'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
