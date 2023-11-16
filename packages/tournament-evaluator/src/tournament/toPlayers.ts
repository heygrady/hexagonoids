import type { GenomeEntry } from '@neat-evolution/evaluator'

import { toGenomeId } from './GenomeId.js'
import type { Player } from './types.js'

export const toPlayers = (
  genomeEntries: Iterable<GenomeEntry<any>>
): Player[] => {
  const players: Player[] = []
  for (const [speciesIndex, organismIndex, genome] of genomeEntries) {
    players.push([
      toGenomeId(speciesIndex, organismIndex),
      // FIXME: GenomeEntry should probably be an AnyCoreGenome so that toFactoryOptions will be defined
      genome.toFactoryOptions(),
    ])
  }
  return players
}
