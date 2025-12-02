import {
  calculateNormalizationBounds,
  type TicTacToeEnvironmentConfig,
} from '@heygrady/tictactoe-environment'
import type { GlickoStrategyOptions } from '@heygrady/tournament-strategy'

export const gameOutcomeScores = {
  win: 1,
  draw: 0.5,
  loss: -0.1,
}

export const confidenceMultiplier = {
  min: 1,
  max: 1,
}

export const defaultEnvironmentConfig: Partial<TicTacToeEnvironmentConfig> = {
  gameOutcomeScores,
  confidenceMultiplier,
  moveWeighting: { strategy: 'equal' },
  positionWeights: {
    firstPlayer: 2 / 5,
    secondPlayer: 3 / 5,
  },
  gauntletOpponents: [
    {
      opponent: 'minimaxAI',
      numGames: 5,
      weight: 0.6,
    },
    {
      opponent: 'sleeperAI',
      numGames: 30,
      weight: 0.4,
    },
  ],
}

const environmentFitnessBounds = calculateNormalizationBounds(
  gameOutcomeScores,
  confidenceMultiplier
)

export const normalizationRanges = {
  environmentFitness: environmentFitnessBounds,
  seedFitness: environmentFitnessBounds,
  glickoRating: {
    min: 800,
    max: 2100,
  },
  conservativeRating: {
    min: 500,
    max: 2000,
  },
}

export const defaultStrategyOptions: Partial<GlickoStrategyOptions<any>> = {
  matchPlayerSize: 2,
  individualSeeding: true,
  numSeedTournaments: 25,
  fitnessWeights: {
    seedWeight: 0.4,
    envWeight: 0.0,
    glickoWeight: 0.6,
    conservativeWeight: 0.0,
  },
  normalizationRanges,
}
