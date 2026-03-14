/**
 * Runs the Vanilla, AC-Lamarck, and QL-Lamarck comparison and prints a table.
 *
 * The command layer is responsible for parsing flags and translating them into
 * `EpisodicOptions` before calling this handler.
 */

import {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  type FitnessWeights,
  type GateConfig,
} from '@heygrady/hexagonoids-environment'
import { defaultProfile } from '../profiles/index.js'
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
  const profileConfig = defaultProfile.config ?? {}

  // Start from the tuned default profile, then override for episodic runs.
  // Deep-merge structured objects (fitnessWeights, gateConfig) the same way
  // the training-oriented workflows do. Only override method, scenarioMode,
  // baseSeed, and explicit options handed in by the command layer.
  const shared: TrainOptions = {
    ...profileConfig,
    // Episodic overrides
    scenarioMode: true,
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
        rlLearningRate: 0.1,
      },
    },
    {
      name: 'QL-Lamarck',
      trainOptions: {
        ...shared,
        rlMode: 'q-learning',
        rlIsLamarckian: true,
        rlLearningRate: 0.1,
        rlEpsilonDecay: 0.1,
        rlMultiDiscrete: true,
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

  console.log('=== Hexagonoids Episodic: Vanilla vs AC vs QL ===')
  console.log(
    `Iterations: ${iterations}, Population: ${populationSize}, MaxTicks: ${maxTicks}`
  )
  console.log()

  const results: VariantResult[] = []

  for (const variant of variants) {
    console.log(`Running: ${variant.name}...`)
    const start = performance.now()
    const result = await train(variant.trainOptions)
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
