import {
  createEnvironment,
  type TicTacToeEnvironmentConfig,
  calculateNormalizationBounds,
} from '@heygrady/tictactoe-environment'
import {
  // SwissTournamentStrategy,
  GlickoStrategy,
  type GlickoObservedRanges,
  type HeroGenome,
  // type FitnessCalculator,
} from '@heygrady/tournament-strategy'
import { Activation, defaultNEATConfigOptions } from '@neat-evolution/core'
import {
  CPPNAlgorithm,
  cppn,
  defaultCPPNGenomeOptions,
} from '@neat-evolution/cppn'
import {
  DESHyperNEATAlgorithm,
  deshyperneat,
  defaultDESHyperNEATGenomeOptions,
  defaultTopologyConfigOptions,
} from '@neat-evolution/des-hyperneat'
import {
  ESHyperNEATAlgorithm,
  eshyperneat,
  defaultESHyperNEATGenomeOptions,
} from '@neat-evolution/es-hyperneat'
import type { AnyGenome } from '@neat-evolution/evaluator'
import {
  type EvolutionOptions,
  type ReproducerFactory,
  defaultEvolutionOptions,
  defaultPopulationOptions,
} from '@neat-evolution/evolution'
import {
  HyperNEATAlgorithm,
  hyperneat,
  defaultHyperNEATGenomeOptions,
} from '@neat-evolution/hyperneat'
import {
  NEATAlgorithm,
  neat,
  defaultNEATGenomeOptions,
} from '@neat-evolution/neat'
import { WorkerEvaluator } from '@neat-evolution/worker-evaluator'
import {
  type Terminable,
  createReproducerFactory,
} from '@neat-evolution/worker-reproducer'
import { hardwareConcurrency } from '@neat-evolution/worker-threads'

import {
  handleHeroesUpdated,
  initializeHeroesLog,
  // loadInitialHeroes,
  saveHeroesLog,
} from './utils/initialHeroes.js'
import {
  clearObservedRanges,
  handleObservedRangeUpdate,
  readObservedRanges,
} from './utils/normalizationRange.js'
import { writeJsonFile } from './utils/writeJsonFile.js'

const workerThreadLimit = Math.ceil(hardwareConcurrency - 1)

const terminables = new Set<Terminable>()

enum Methods {
  NEAT = 'NEAT',
  CPPN = 'CPPN',
  HyperNEAT = 'HyperNEAT',
  ES_HyperNEAT = 'ES-HyperNEAT',
  DES_HyperNEAT = 'DES-HyperNEAT',
}

const method = Methods.NEAT

const createReproducer: ReproducerFactory<any, any> = createReproducerFactory(
  {
    threadCount: workerThreadLimit,
    enableCustomState: (method as unknown) === Methods.DES_HyperNEAT,
  },
  terminables
)

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
  const environment = createEnvironment(environmentOptions)
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
  const strategy = new GlickoStrategy<any>({
    matchPlayerSize: 2,
    individualSeeding: true, // Evaluate individually for better first-round pairings
    numSeedTournaments: 10,
    fitnessWeights: {
      seedWeight: 0.4, // bot play
      envWeight: 0.0,
      glickoWeight: 0.6, // tournament play
      conservativeWeight: 0.0,
    },
    // initialHeroes: await loadInitialHeroes(),
    normalizationRanges,
    // heroPoolRatio: 0.0,
    onHeroesUpdated: (heroes: Array<HeroGenome<AnyGenome<any>>>) => {
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
  })

  const evolutionOptions: EvolutionOptions<any, any> = {
    ...defaultEvolutionOptions,
    iterations: 10_000,
    secondsLimit: 10_800,
    earlyStop: true,
    earlyStopPatience: 150,
    // afterEvaluate,
    // afterEvaluateInterval: 100,
  }
  const neatOptions = {
    ...defaultNEATConfigOptions,
    mutateOnlyOneLink: false,
  }
  const populationOptions = {
    ...defaultPopulationOptions,
  }
  const allActivations: Activation[] = [
    Activation.Linear,
    Activation.Step,
    Activation.ReLU,
    Activation.LeakyReLU,
    Activation.ELU,
    Activation.Sigmoid,
    Activation.Swish,
    Activation.HardSigmoid,
    Activation.Tanh,
    Activation.HardTanh,
    Activation.Gaussian,
    Activation.OffsetGaussian,
    Activation.GELU,
    Activation.Square,
    Activation.Abs,
    Activation.Softsign,
    Activation.Exp,
    Activation.ClippedExp,
    Activation.Softplus,
    Activation.Mish,
  ]

  const cppnActivationOptions = {
    hiddenActivations: allActivations,
    outputActivations: [Activation.Softmax],
  }

  const activationOptions = {
    hiddenActivation: Activation.GELU, // Gaussian
    outputActivation: Activation.Softmax,
  }

  const evolve = async (method: Methods) => {
    switch (method) {
      case Methods.NEAT: {
        const evaluator = new WorkerEvaluator(NEATAlgorithm, environment, {
          createEnvironmentPathname: '@heygrady/tictactoe-environment',
          createExecutorPathname: '@neat-evolution/executor',
          taskCount: defaultPopulationOptions.populationSize,
          threadCount: workerThreadLimit,
          strategy,
        })

        const genomeOptions = {
          ...defaultNEATGenomeOptions,
          ...activationOptions,
        }
        terminables.add(evaluator)
        return await neat(
          createReproducer,
          evaluator,
          evolutionOptions,
          neatOptions,
          populationOptions,
          genomeOptions
        )
      }
      case Methods.CPPN: {
        const evaluator = new WorkerEvaluator(CPPNAlgorithm, environment, {
          createEnvironmentPathname: '@heygrady/tictactoe-environment',
          createExecutorPathname: '@neat-evolution/executor',
          taskCount: defaultPopulationOptions.populationSize,
          threadCount: workerThreadLimit,
          strategy,
        })

        const genomeOptions = {
          ...defaultCPPNGenomeOptions,
          ...activationOptions,
          ...cppnActivationOptions,
        }
        terminables.add(evaluator)
        return await cppn(
          createReproducer,
          evaluator,
          evolutionOptions,
          neatOptions,
          populationOptions,
          genomeOptions
        )
      }
      case Methods.HyperNEAT: {
        const evaluator = new WorkerEvaluator(HyperNEATAlgorithm, environment, {
          createEnvironmentPathname: '@heygrady/tictactoe-environment',
          createExecutorPathname: '@neat-evolution/executor',
          taskCount: populationOptions.populationSize,
          threadCount: workerThreadLimit,
          strategy,
        })
        const genomeOptions = {
          ...defaultHyperNEATGenomeOptions,
          ...activationOptions,
          ...cppnActivationOptions,
        }
        terminables.add(evaluator)
        return await hyperneat(
          createReproducer,
          evaluator,
          evolutionOptions,
          neatOptions,
          populationOptions,
          genomeOptions
        )
      }
      case Methods.ES_HyperNEAT: {
        const evaluator = new WorkerEvaluator(
          ESHyperNEATAlgorithm,
          environment,
          {
            createEnvironmentPathname: '@heygrady/tictactoe-environment',
            createExecutorPathname: '@neat-evolution/executor',
            taskCount: populationOptions.populationSize,
            threadCount: workerThreadLimit,
            strategy,
          }
        )
        const genomeOptions = {
          ...defaultESHyperNEATGenomeOptions,
          ...cppnActivationOptions,
          ...activationOptions,
        }
        terminables.add(evaluator)
        return await eshyperneat(
          createReproducer,
          evaluator,
          evolutionOptions,
          neatOptions,
          populationOptions,
          genomeOptions
        )
      }
      case Methods.DES_HyperNEAT: {
        const evaluator = new WorkerEvaluator(
          DESHyperNEATAlgorithm,
          environment,
          {
            createEnvironmentPathname: '@heygrady/tictactoe-environment',
            createExecutorPathname: '@neat-evolution/executor',
            taskCount: populationOptions.populationSize,
            threadCount: workerThreadLimit,
            strategy,
          }
        )
        const genomeOptions = {
          ...defaultDESHyperNEATGenomeOptions,
          ...cppnActivationOptions,
          ...activationOptions,
        }
        const topologyOptions = {
          ...defaultTopologyConfigOptions,
          mutateOnlyOneLink: false,
        }
        terminables.add(evaluator)
        return await deshyperneat(
          createReproducer,
          evaluator,
          evolutionOptions,
          topologyOptions,
          neatOptions,
          populationOptions,
          genomeOptions
        )
      }
    }
  }
  const best = await evolve(method)
  const data = best?.toJSON() ?? null
  await writeJsonFile(
    new URL(`../../best-${method}.json`, import.meta.url).pathname,
    data
  )
  return best
}

await demo()

await saveHeroesLog()

for (const terminable of terminables) {
  await terminable.terminate()
}
