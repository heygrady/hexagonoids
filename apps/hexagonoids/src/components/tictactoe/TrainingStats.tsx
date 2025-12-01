import { useStore } from '@nanostores/solid'

import { useGame } from './hooks/useGame.js'
import { subscribeSettings } from './hooks/useSettings.js'
import { SettingsPanel } from './SettingsPanel.js'
import type { GenerationSnapshot } from './stores/game/GameState.js'

export function TrainingStats() {
  const [$game] = useGame()
  const game = useStore($game)
  const settings = subscribeSettings()

  const isTraining = () => game().evolutionPromise != null

  // Determine which entity to display based on state
  const displayedGeneration = (): GenerationSnapshot | undefined => {
    // Priority: training > pending > committed/best > opponent
    const training = game().training
    if (training != null) {
      return training
    }

    const useBestOpponent = settings().committed.useBestOpponent

    // Use best opponent if setting is enabled, otherwise use committed
    if (useBestOpponent) {
      const best = game().best
      if (best != null) {
        return best
      }
    }

    const pending = game().pending
    if (pending != null) {
      return pending
    }

    const committed = game().committed
    if (committed != null) return committed

    // Fallback to opponent (may be undefined initially)
    return game().opponent
  }

  const maxGeneration = () => {
    return (
      game().training?.generation ??
      game().pending?.generation ??
      game().committed?.generation ??
      game().opponent?.generation ??
      0
    )
  }

  const ratingDisplay = () => {
    const rating = game().opponent?.glickoData?.rating
    return `Rating: ${rating != null ? rating.toFixed(0) : '0'} | `
  }

  return (
    <div class='relative'>
      <div class='absolute top-2 right-2 z-10'>
        <SettingsPanel />
      </div>
      <div class='stats shadow w-full bg-base-200'>
        {/* Opponent Status */}
        <div class='stat'>
          <div class='stat-title'>Opponent</div>
          <div class='stat-value text-secondary'>
            Gen {game().opponent?.generation ?? 0}
          </div>
          <div class='stat-desc'>
            {ratingDisplay()}Fitness:{' '}
            {(game().opponent?.fitness ?? 0).toFixed(2)}
          </div>
        </div>

        {/* Training Status */}
        <div class='stat'>
          <div class='stat-title'>
            {isTraining() ? 'Training' : 'Next Opponent'}
          </div>
          <div class='stat-value text-accent'>
            {displayedGeneration()?.generation ?? 0}
            {isTraining() ? '' : ` / ${maxGeneration()}`}
          </div>
          <div class='stat-desc'>
            Fitness: {(displayedGeneration()?.fitness ?? 0).toFixed(2)} | Best:{' '}
            {(game().best?.fitness ?? 0).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  )
}
