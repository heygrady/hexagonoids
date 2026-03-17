import {
  calculateNormalizationBounds,
  type TicTacToeEnvironmentConfig,
} from '@heygrady/tictactoe-environment'
import {
  type GlickoObservedRanges,
  type HeroGenome,
} from '@heygrady/tournament-strategy'
import {
  defaultEvolutionOptions,
  type EvolutionOptions,
} from '@neat-evolution/evolution'
import { EvolutionManager } from '@neat-evolution/evolution-manager'
import { hardwareConcurrency } from '@neat-evolution/worker-threads'

import { getAlgorithmDefinition, type SupportedAlgorithm } from './algorithmRegistry.js'
import {
  createTictactoeManagerConfig,
  DEFAULT_POPULATION_SIZE,
} from './createManagerConfig.js'
import {
  handleHeroesUpdated,
  initializeHeroesLog,
  saveHeroesLog,
} from './utils/initialHeroes.js'
import {
  clearObservedRanges,
  handleObservedRangeUpdate,
  readObservedRanges,
} from './utils/normalizationRange.js'
import { writeJsonFile } from './utils/writeJsonFile.js'

const workerThreadLimit = Math.ceil(hardwareConcurrency - 1)
const method: SupportedAlgorithm = 'NEAT'

export const demo = async () => {
  await initializeHeroesLog()
  const confidenceMultiplier = {
    min: 1,
    max: 1,
  }
  const gameOutcomeScores = {
    win: 1,
    draw: 0.5,
    loss: -0.1,
  }
  const environmentOptions: Partial<TicTacToeEnvironmentConfig> = {
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
        weight: 1 / 3,
      },
      {
        opponent: 'heuristicAI',
        numGames: 5,
        weight: 1 / 3,
      },
      {
        opponent: 'sleeperAI',
        numGames: 25,
        weight: 1 / 3,
      },
      // {
      //   opponent: 'randomAI',
      //   numGames: 25,
      //   weight: 1 / 3,
      // },
    ],
  }
  await clearObservedRanges()
  const observedRanges = await readObservedRanges()
  const environmentFitnessBounds = calculateNormalizationBounds(
    gameOutcomeScores,
    confidenceMultiplier
  )
  const normalizationRanges = {
    environmentFitness: environmentFitnessBounds,
    seedFitness: environmentFitnessBounds,
    glickoRating: {
      min: 800,
      max: 2100,
    },
    conservativeRating: {
      min: 400,
      max: 2000,
    },
  }
  let bestHeroRating = -Infinity
  const strategyOptions = {
    matchPlayerSize: 2,
    individualSeeding: true, // Evaluate individually for better first-round pairings
    numSeedTournaments: 10,
    fitnessWeights: {
      seedWeight: 0.4, // bot play
      envWeight: 0.0,
      glickoWeight: 0.6, // tournament play
      conservativeWeight: 0.0,
    },
    normalizationRanges,
    onHeroesUpdated: (heroes: Array<HeroGenome<any>>) => {
      const [bestHero] = heroes
      if (bestHero == null) return
      const heroRating = bestHero[1].rating ?? 0
      if (heroRating > bestHeroRating) {
        bestHeroRating = heroRating
        console.log(`🦸 New best hero rating: ${bestHeroRating.toFixed(2)}`)
      }
      handleHeroesUpdated(heroes)
    },
    onObservedRangeUpdate: (newObservedRanges: GlickoObservedRanges) => {
      handleObservedRangeUpdate(newObservedRanges, observedRanges)
    },
  }

  const evolutionOptions: EvolutionOptions<any, any> = {
    ...defaultEvolutionOptions,
    iterations: 10_000,
    secondsLimit: 10_800,
    earlyStop: true,
    earlyStopPatience: 150,
  }

  const manager = new EvolutionManager({
    ...createTictactoeManagerConfig({
      algorithm: method,
      environmentConfig: environmentOptions,
      populationOptions: { populationSize: DEFAULT_POPULATION_SIZE },
      strategyOptions,
    }),
    createEnvironmentPathname: '@heygrady/tictactoe-environment',
    evolutionOptions,
    evaluatorConfig: {
      algorithmPathname: getAlgorithmDefinition(method).algorithm.pathname,
      threadCount: workerThreadLimit,
      taskCount: DEFAULT_POPULATION_SIZE,
    },
  })

  let best: any
  try {
    best = await manager.evolve()
  } finally {
    await manager.terminate()
  }

  const data = best?.toJSON() ?? null
  await writeJsonFile(
    new URL(`../../best-${method}.json`, import.meta.url).pathname,
    data
  )
  return best
}

await demo()

await saveHeroesLog()
