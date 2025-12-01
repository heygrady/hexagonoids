import { AutoPlayControl } from './AutoPlayControl.js'
import { MatchStats } from './MatchStats.js'

export function GameHud() {
  return (
    <div class='flex flex-col gap-2 sm:gap-4 mt-2 sm:mt-4 w-full'>
      {/* Controls / Header */}
      <AutoPlayControl />

      {/* Training Stats Row */}
      <MatchStats />
    </div>
  )
}
