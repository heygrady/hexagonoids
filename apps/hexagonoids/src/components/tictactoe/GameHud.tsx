import { AutoPlayControl } from './AutoPlayControl.js'
import { MatchStats } from './MatchStats.js'

export function GameHud() {
  return (
    <div class='flex flex-col gap-4 mt-4 w-full max-w-4xl mx-auto'>
      {/* Controls / Header */}
      <AutoPlayControl />

      {/* Training Stats Row */}
      <MatchStats />
    </div>
  )
}
