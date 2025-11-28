import { useStore } from '@nanostores/solid'
import { Show } from 'solid-js'

import { useGame } from './hooks/useGame.js'

export function AutoPlayControl() {
  const [$game, gameActions] = useGame()
  const game = useStore($game)

  const handleToggleAutoPlay = () => {
    if (game().autoPlay) {
      gameActions.disableAutoPlay()
    } else {
      gameActions.enableAutoPlay()
    }
  }

  return (
    <div class='flex justify-end min-h-[2rem]'>
      <Show when={game().autoPlay || game().isWaitingForEvolution}>
        <button
          onClick={handleToggleAutoPlay}
          class={`btn btn-primary btn-sm ${
            !game().autoPlay ? 'animate-pulse' : ''
          }`}
        >
          {game().autoPlay ? 'Wait for Training' : 'Keep Playing'}
        </button>
      </Show>
    </div>
  )
}
