import { createSignal, onMount, Show } from 'solid-js'

import { createGame } from './createGame.js'
import { GameHud } from './GameHud.js'
import { TicTacToeBoard } from './TicTacToeBoard.js'
import { TicTacToeContext } from './TicTacToeContext.js'
import { TrainingStats } from './TrainingStats.js'

export const TicTacToeGame = () => {
  const [game, setGame] = createSignal<Awaited<
    ReturnType<typeof createGame>
  > | null>(null)

  // Wait for game to initialize (includes settings loading)
  onMount(() => {
    void (async () => {
      const gameInstance = await createGame(3)
      setGame(() => gameInstance)

      // Auto-start the game with AI going first
      gameInstance[1].start().catch((error) => {
        console.error('Error auto-starting game:', error)
      })
    })()
  })

  return (
    <Show when={game()} fallback={<div>Loading...</div>}>
      {(gameInstance) => (
        <TicTacToeContext.Provider value={gameInstance()}>
          <div class='mb-4 w-full max-w-4xl mx-auto'>
            <TrainingStats />
          </div>
          <TicTacToeBoard />
          <GameHud />
        </TicTacToeContext.Provider>
      )}
    </Show>
  )
}
