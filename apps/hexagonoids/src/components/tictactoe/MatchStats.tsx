import { useStore } from '@nanostores/solid'

import { GLICKO_DEFAULT_RATING } from './constants/glickoSettings.js'
import { useGame } from './hooks/useGame.js'

export function MatchStats() {
  const [$game] = useGame()
  const game = useStore($game)

  const opponentGen = () => game().opponent?.generation ?? 0
  const displayPlayerRating = () => {
    return (
      game().playerGlickoData?.rating.toFixed(0) ?? `${GLICKO_DEFAULT_RATING}`
    )
  }
  const displayGlickoStatus = () => {
    const glickoData = game().playerGlickoData
    if (glickoData == null) return `(Provisional)`

    const rd = glickoData.rd
    const status = rd < 100 ? 'Established' : 'Provisional'
    return `(${status} ±${(rd * 2).toFixed(0)})`
  }

  return (
    <div class='stats shadow w-full bg-base-200'>
      <div class='stat'>
        <div class='stat-title'>Score (W-D-L)</div>
        <div class='stat-value text-primary'>
          {game().winCount}-{game().drawCount}-{game().lossCount}
        </div>
        <div class='stat-desc'>Vs. Generation {opponentGen()}</div>
      </div>

      <div class='stat'>
        <div class='stat-title'>Player Rating</div>
        <div class='stat-value text-secondary'>{displayPlayerRating()}</div>
        <div class='stat-desc'>{displayGlickoStatus()}</div>
      </div>
    </div>
  )
}
