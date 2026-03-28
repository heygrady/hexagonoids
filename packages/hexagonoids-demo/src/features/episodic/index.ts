/**
 * Runs the Vanilla, AC-Lamarck, QL-Lamarck, A2C-Lamarck, DQL-Lamarck, and PPO-Lamarck comparison and prints a table.
 *
 * The command layer is responsible for parsing flags and translating them into
 * `EpisodicOptions` before calling this handler.
 */

import {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  type FitnessWeights,
  type GateConfig,
} from '@heygrady/hexagonoids-environment'
import { defaultProfile, mergeTrainingProfileConfig } from '../profiles/index.js'
import {
  type TrainingRunResult,
  type TrainOptions,
  type TrainResult,
  train,
} from '../training/train.js'

export interface EpisodicOptions {
  iterations?: number | undefined
  maxTicks?: number | undefined
  populationSize?: number | undefined
  baseSeed?: string | undefined
  threadCount?: number | undefined
  signal?: AbortSignal | undefined
}

interface VariantConfig {
  name: string
  trainOptions: TrainOptions
}

const DEFAULT_BASE_SEED = 'hexagonoids-episodic'

function buildVariants(options: EpisodicOptions): VariantConfig[] {
  const profileConfig = mergeTrainingProfileConfig(
    defaultProfile.config,
    { runtimeHooks: defaultProfile.hooks }
  ) as Partial<TrainOptions>

  // Start from the tuned default profile, then override for episodic runs.
  // Deep-merge structured objects (fitnessWeights, gateConfig) the same way
  // the training-oriented workflows do. scenarioMode is inferred from
  // scenarioWeight > 0. Only override baseSeed and explicit options.
  const shared: TrainOptions = {
    ...profileConfig,
    // Episodic overrides
    baseSeed: options.baseSeed ?? DEFAULT_BASE_SEED,
    // Edge overrides (only when provided)
    ...(options.iterations != null && { iterations: options.iterations }),
    ...(options.populationSize != null && {
      populationSize: options.populationSize,
    }),
    ...(options.maxTicks != null && { maxTicks: options.maxTicks }),
    ...(options.threadCount != null && { threadCount: options.threadCount }),
    ...(options.signal != null && { signal: options.signal }),
    // Deep merge structured objects from profile
    fitnessWeights: {
      ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fitnessWeights,
      ...profileConfig.fitnessWeights,
    } as FitnessWeights,
    gateConfig: {
      ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.gateConfig,
      ...profileConfig.gateConfig,
    } as GateConfig,
  }

  return [
    {
      name: 'Vanilla',
      trainOptions: {
        ...shared,
        rlMode: 'none',
      },
    },
    {
      name: 'AC-Lamarck',
      trainOptions: {
        ...shared,
        rlMode: 'actor-critic',
        rlIsLamarckian: true,
        rlLearningRate: 0.001,
      },
    },
    {
      name: 'QL-Lamarck',
      trainOptions: {
        ...shared,
        rlMode: 'q-learning',
        rlIsLamarckian: true,
        rlLearningRate: 0.001,
      },
    },
    {
      name: 'A2C-Lamarck',
      trainOptions: {
        ...shared,
        rlMode: 'a2c',
        rlIsLamarckian: true,
        rlLearningRate: 0.001,
      },
    },
    {
      name: 'DQL-Lamarck',
      trainOptions: {
        ...shared,
        rlMode: 'dql',
        rlIsLamarckian: true,
        rlLearningRate: 0.001,
      },
    },
    {
      name: 'PPO-Lamarck',
      trainOptions: {
        ...shared,
        rlMode: 'ppo',
        rlIsLamarckian: true,
        rlLearningRate: 0.0003,
      },
    },
  ]
}

function isTrainingResult(result: TrainResult): result is TrainingRunResult {
  return result.mode === 'training'
}

interface VariantResult {
  name: string
  bestFitness: number
  populationMean: number | null
  populationMedian: number | null
  elapsedMs: number
}

export async function runEpisodic(
  options: EpisodicOptions = {}
): Promise<VariantResult[]> {
  const variants = buildVariants(options)
  const first = variants[0]
  const iterations = first?.trainOptions.iterations ?? 50
  const populationSize = first?.trainOptions.populationSize ?? 100
  const maxTicks = first?.trainOptions.maxTicks ?? 2048

  console.log(
    '=== Hexagonoids Episodic: Vanilla vs AC vs QL vs A2C vs DQL vs PPO ==='
  )
  console.log(
    `Iterations: ${iterations}, Population: ${populationSize}, MaxTicks: ${maxTicks}`
  )
  console.log()

  const results: VariantResult[] = []

  for (const variant of variants) {
    console.log(`Running: ${variant.name}...`)
    const start = performance.now()
    let result: TrainResult
    try {
      result = await train(variant.trainOptions)
    } catch (error) {
      console.error(`  ERROR in ${variant.name}:`, error)
      continue
    }
    const elapsedMs = performance.now() - start

    if (isTrainingResult(result)) {
      const variantResult: VariantResult = {
        name: variant.name,
        bestFitness: result.bestFitness,
        populationMean: result.populationFitnessMean,
        populationMedian: result.populationFitnessMedian,
        elapsedMs,
      }
      results.push(variantResult)
      console.log(
        `  Done: best=${result.bestFitness.toFixed(4)} in ${(elapsedMs / 1000).toFixed(1)}s`
      )
    } else {
      console.log(`  Unexpected result mode: ${result.mode}`)
    }
  }

  // Print comparison table
  console.log()
  console.log('=== Comparison ===')
  console.log()

  const colWidth = 14
  const nameWidth = 14

  console.log(
    `${'Variant'.padEnd(nameWidth)}${'Best'.padStart(colWidth)}${'Mean'.padStart(colWidth)}${'Median'.padStart(colWidth)}${'Time'.padStart(colWidth)}`
  )
  console.log('-'.repeat(nameWidth + colWidth * 4))

  for (const r of results) {
    const meanStr =
      r.populationMean != null ? r.populationMean.toFixed(4) : 'n/a'
    const medianStr =
      r.populationMedian != null ? r.populationMedian.toFixed(4) : 'n/a'
    console.log(
      `${r.name.padEnd(nameWidth)}${r.bestFitness.toFixed(4).padStart(colWidth)}${meanStr.padStart(colWidth)}${medianStr.padStart(colWidth)}${`${(r.elapsedMs / 1000).toFixed(1)}s`.padStart(colWidth)}`
    )
  }

  return results
}
