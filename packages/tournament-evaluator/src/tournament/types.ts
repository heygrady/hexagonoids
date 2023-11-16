import type { GenomeFactoryOptions } from '@neat-evolution/core'

import type { GenomeId } from './GenomeId.js'

export type Player = [
  genomeId: GenomeId,
  genomeFactoryOptions: GenomeFactoryOptions<any, any>,
]
export type PlayerScore = [genomeId: GenomeId, score: number]
export type FitnessEntry = [
  speciesIndex: number,
  organismIndex: number,
  fitness: number,
]

export type EvaluateGameCallbackFn = (
  players: Player[]
) => Promise<PlayerScore[]>

export type TournamentScores = PlayerScore[][]
