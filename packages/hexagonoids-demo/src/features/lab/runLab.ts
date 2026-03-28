import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  type FitnessWeights,
  type GateConfig,
} from '@heygrady/hexagonoids-environment'

const PACKAGE_ROOT = fileURLToPath(new URL('../../../..', import.meta.url))

import { defaultProfile } from '../profiles/index.js'
import {
  formatResolvedProfileSummary,
  mergeTrainingProfileConfig,
} from '../profiles/index.js'
import { resolveProfile } from '../profiles/resolveProfile.js'
import { LAB_ANALYSIS_DEFAULTS } from '../runtime/configDefaults.js'
import { type TrainOptions, train } from '../training/train.js'
import { generateReport } from './generateReport.js'
import type { LabConfig, LabOptions } from './types.js'
import { createLabWorkerPool } from './workerLabPool.js'

function createExperimentId(name?: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  if (name != null && name.length > 0) {
    return `${name}-${timestamp}`
  }
  return timestamp
}

export async function runLab(options: LabOptions = {}): Promise<{
  experimentDir: string
  analysisPath: string
  summaryPath: string
}> {
  const profile = await resolveProfile(options.profilePath)
  const resolvedProfileConfig = mergeTrainingProfileConfig(profile.config, {
    runtimeHooks: profile.hooks,
  })
  const profileTrainConfig = resolvedProfileConfig as Partial<TrainOptions>

  const experimentId = createExperimentId(options.name)
  const experimentDir = resolve(PACKAGE_ROOT, '.artifacts', 'lab', experimentId)
  await mkdir(experimentDir, { recursive: true })

  // Merge config: default profile -> loaded profile -> explicit command options
  const trainOptions = mergeTrainingProfileConfig(
    defaultProfile.config,
    profileTrainConfig,
    options,
    {
      fitnessWeights: {
        ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fitnessWeights,
        ...defaultProfile.config?.fitnessWeights,
        ...resolvedProfileConfig.fitnessWeights,
        ...options.fitnessWeights,
      },
      gateConfig: {
        ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.gateConfig,
        ...defaultProfile.config?.gateConfig,
        ...resolvedProfileConfig.gateConfig,
        ...options.gateConfig,
      },
      outputDir: experimentDir,
    }
  ) as TrainOptions

  const config: LabConfig = {
    experimentId,
    analysisSeedsPerGenome:
      options.analysisSeedsPerGenome ??
      resolvedProfileConfig.analysisSeedsPerGenome ??
      LAB_ANALYSIS_DEFAULTS.analysisSeedsPerGenome,
    analysisMaxTicks:
      options.analysisMaxTicks ??
      resolvedProfileConfig.analysisMaxTicks ??
      LAB_ANALYSIS_DEFAULTS.analysisMaxTicks,
    trainOptions,
  }

  // Save config snapshot
  await writeFile(
    join(experimentDir, 'config.json'),
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8'
  )

  const method = trainOptions.method ?? 'HyperNEAT'

  console.log(`\nLab experiment: ${experimentId}`)
  console.log(`Output: ${experimentDir}`)
  for (const line of formatResolvedProfileSummary(profile, trainOptions)) {
    console.log(line)
  }
  console.log(
    `Method: ${method}, Iterations: ${trainOptions.iterations ?? '?'}, Population: ${trainOptions.populationSize ?? '?'}`
  )
  console.log('')

  // Phase 1: Train
  console.log('Phase 1: Training...')
  const trainResult = await train(trainOptions)

  if (trainResult.mode !== 'training') {
    throw new Error('Expected training mode result.')
  }

  console.log(
    `Training complete. Best fitness: ${trainResult.bestFitness.toFixed(4)}`
  )
  console.log('')

  // Phase 2: Analyze
  console.log('Phase 2: Analyzing genomes...')
  const genomesDir = join(experimentDir, 'genomes')
  let genomeFiles: string[]
  try {
    const entries = await readdir(genomesDir)
    genomeFiles = entries
      .filter((f) => f.startsWith('gen-') && f.endsWith('.json'))
      .sort()
      .map((f) => join(genomesDir, f))
  } catch {
    genomeFiles = []
  }

  if (genomeFiles.length === 0) {
    throw new Error('No genomes found to analyze.')
  }

  console.log(`Found ${genomeFiles.length} genomes to analyze.`)

  const labPool = await createLabWorkerPool({
    threadCount: options.threadCount,
  })

  const behaviors = await labPool.analyzeGenomesParallel({
    genomePaths: genomeFiles,
    method,
    seedsPerGenome: config.analysisSeedsPerGenome,
    maxTicks: config.analysisMaxTicks,
    dtMs: trainOptions.dtMs ?? 33,
    baseSeed: trainOptions.baseSeed ?? 'hexagonoids-phase03',
    fitnessWeights: trainOptions.fitnessWeights as FitnessWeights | undefined,
    gateConfig: trainOptions.gateConfig as GateConfig | undefined,
    onProgress: (completed, total) => {
      process.stdout.write(`\r  Analyzing genome ${completed}/${total}...`)
    },
  })

  await labPool.terminate()
  console.log('')

  // Phase 3: Report
  console.log('Phase 3: Generating report...')
  const analysis = { config, behaviors }
  const { analysisPath, summaryPath } = await generateReport(
    analysis,
    experimentDir
  )

  console.log(`\nLab complete!`)
  console.log(`  Analysis: ${analysisPath}`)
  console.log(`  Summary:  ${summaryPath}`)

  return { experimentDir, analysisPath, summaryPath }
}
