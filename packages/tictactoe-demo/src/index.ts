import { createEnvironment } from '@heygrady/game-environment'
import {
  createGameExecutor,
  type TicTacToeGameData,
  type TicTacToeGameOptions,
} from '@heygrady/tictactoe-game'
import {
  createEvaluator as createTournamentEvaluator,
  type TournamentEvaluatorOptions,
} from '@heygrady/tournament-evaluator'
import { defaultNEATConfigOptions } from '@neat-evolution/core'
import {
  defaultCPPNGenomeOptions,
  cppn,
  CPPNAlgorithm,
} from '@neat-evolution/cppn'
import {
  defaultDESHyperNEATGenomeOptions,
  defaultTopologyConfigOptions,
  deshyperneat,
  DESHyperNEATAlgorithm,
} from '@neat-evolution/des-hyperneat'
import {
  defaultESHyperNEATGenomeOptions,
  eshyperneat,
  ESHyperNEATAlgorithm,
} from '@neat-evolution/es-hyperneat'
import {
  defaultEvolutionOptions,
  defaultPopulationOptions,
  type EvolutionOptions,
  type ReproducerFactory,
} from '@neat-evolution/evolution'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'
import {
  defaultHyperNEATGenomeOptions,
  hyperneat,
  HyperNEATAlgorithm,
} from '@neat-evolution/hyperneat'
import {
  defaultNEATGenomeOptions,
  neat,
  NEATAlgorithm,
} from '@neat-evolution/neat'
import {
  createReproducerFactory,
  type Terminable,
} from '@neat-evolution/worker-reproducer'
import { hardwareConcurrency } from '@neat-evolution/worker-threads'

const workerThreadLimit = hardwareConcurrency - 1

const terminables = new Set<Terminable>()

enum Methods {
  NEAT = 'NEAT',
  CPPN = 'CPPN',
  HyperNEAT = 'HyperNEAT',
  ES_HyperNEAT = 'ES-HyperNEAT',
  DES_HyperNEAT = 'DES-HyperNEAT',
}

const method = Methods.ES_HyperNEAT

const createReproducer: ReproducerFactory<any, any> = createReproducerFactory(
  {
    threadCount: workerThreadLimit,
    enableCustomState: (method as unknown) === Methods.DES_HyperNEAT,
  },
  terminables
)

export const demo = async () => {
  const gameOptions: TicTacToeGameOptions = {
    boardSize: 5,
  }
  const gameExecutor = createGameExecutor(gameOptions)
  const tournamentOptions: TournamentEvaluatorOptions = {
    taskCount: defaultPopulationOptions.populationSize,
    threadCount: workerThreadLimit,
    createExecutorPathname: '@neat-evolution/executor',
    gameExecutor,
  }

  const environment = createEnvironment<
    [executor1: SyncExecutor, executor2: SyncExecutor],
    [executor1: Executor, executor2: Executor],
    TicTacToeGameData
  >({
    description: gameExecutor.description,
    gameExecutor,
  })

  const evolutionOptions: EvolutionOptions = {
    ...defaultEvolutionOptions,
    iterations: 5_000,
    secondsLimit: 600,
  }

  const createEvaluator = createTournamentEvaluator<
    [executor1: SyncExecutor, executor2: SyncExecutor],
    [executor1: Executor, executor2: Executor],
    TicTacToeGameData
  >

  const evolve = async (method: Methods) => {
    switch (method) {
      case Methods.NEAT: {
        const evaluator = createEvaluator(
          NEATAlgorithm,
          environment,
          tournamentOptions
        )
        return await neat(
          createReproducer,
          evaluator,
          evolutionOptions,
          defaultNEATConfigOptions,
          defaultPopulationOptions,
          defaultNEATGenomeOptions
        )
      }
      case Methods.CPPN: {
        const evaluator = createEvaluator(
          CPPNAlgorithm,
          environment,
          tournamentOptions
        )
        return await cppn(
          createReproducer,
          evaluator,
          evolutionOptions,
          defaultNEATConfigOptions,
          defaultPopulationOptions,
          defaultCPPNGenomeOptions
        )
      }
      case Methods.HyperNEAT: {
        const evaluator = createEvaluator(
          HyperNEATAlgorithm,
          environment,
          tournamentOptions
        )
        return await hyperneat(
          createReproducer,
          evaluator,
          evolutionOptions,
          defaultNEATConfigOptions,
          defaultPopulationOptions,
          defaultHyperNEATGenomeOptions
        )
      }
      case Methods.ES_HyperNEAT: {
        const evaluator = createEvaluator(
          ESHyperNEATAlgorithm,
          environment,
          tournamentOptions
        )
        return await eshyperneat(
          createReproducer,
          evaluator,
          evolutionOptions,
          defaultNEATConfigOptions,
          defaultPopulationOptions,
          defaultESHyperNEATGenomeOptions
        )
      }
      case Methods.DES_HyperNEAT: {
        const evaluator = createEvaluator(
          DESHyperNEATAlgorithm,
          environment,
          tournamentOptions
        )
        return await deshyperneat(
          createReproducer,
          evaluator,
          evolutionOptions,
          defaultTopologyConfigOptions,
          defaultNEATConfigOptions,
          defaultPopulationOptions,
          defaultDESHyperNEATGenomeOptions
        )
      }
    }
  }
  const best = await evolve(method)
  return best
}

await demo()

for (const terminable of terminables) {
  await terminable.terminate()
}
