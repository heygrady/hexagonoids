import { existsSync } from 'node:fs'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG } from '@heygrady/hexagonoids-environment'

const PACKAGE_ROOT = fileURLToPath(new URL('../../../..', import.meta.url))

import type { SupportedAlgorithm } from '../../algorithmRegistry.js'
import { train } from '../../train.js'
import { analyzeGenomes } from './analyzeGenomes.js'
import { generateReport } from './generateReport.js'
import { loadProfile } from './loadProfile.js'
import { resolveProfilePath } from './resolveProfilePath.js'
import type { LabConfig, LabOptions, LabProfile } from './types.js'

const defaultWeights = DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fitnessWeights
const defaultGate = DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.gateConfig

const LAB_DEFAULTS = {
  method: 'HyperNEAT' as SupportedAlgorithm,
  iterations: 30,
  populationSize: 64,
  scenarioMode: true,
  analysisSeedsPerGenome: 8,
  analysisMaxTicks: 3000,
  baseSeed: 'hexagonoids-phase03',
  evaluationSeedsPerOrganism: 4,
  maxTicks: 1500,
  dtMs: 33,
  scenariosPerOrganism: 20,
  scenarioMaxTicks: 120,
  weightRocks: defaultWeights.rocksDestroyed,
  weightAccuracy: defaultWeights.accuracy,
  weightSurvival: defaultWeights.survival,
  gateFloor: defaultGate.floor,
  actionLow: defaultGate.actionLow,
  actionHigh: defaultGate.actionHigh,
  actionSteepness: defaultGate.actionSteepness,
  turnGateFloor: defaultGate.turnFloor,
  turnLow: defaultGate.turnLow,
  turnHigh: defaultGate.turnHigh,
  turnSteepness: defaultGate.turnSteepness,
  scenarioWeight: 1.0,
  scenarioSeedsPerOrganism: 1,
  fullGameSeedsPerOrganism: 1,
}

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
  // Load profile if provided, or auto-detect default.json
  let profile: LabProfile = {}
  let profilePath = options.profilePath
  if (profilePath == null) {
    const defaultPath = resolveProfilePath('default')
    if (existsSync(defaultPath)) {
      profilePath = 'default'
      console.log(`Auto-loading default profile from ${defaultPath}...`)
    }
  }
  if (profilePath != null) {
    const resolvedPath = resolveProfilePath(profilePath)
    if (options.profilePath != null) {
      console.log(`Loading profile from ${resolvedPath}...`)
    }
    profile = await loadProfile(resolvedPath)
  }

  // Merge config: CLI > profile > defaults
  const experimentId = createExperimentId(options.name)
  const method =
    options.method ??
    (profile.config?.method as SupportedAlgorithm | undefined) ??
    LAB_DEFAULTS.method
  const iterations =
    options.iterations ?? profile.config?.iterations ?? LAB_DEFAULTS.iterations
  const populationSize =
    options.populationSize ??
    profile.config?.populationSize ??
    LAB_DEFAULTS.populationSize
  const baseSeed =
    options.baseSeed ??
    (profile.config?.baseSeed as string | undefined) ??
    LAB_DEFAULTS.baseSeed
  const scenarioMode =
    options.scenarioMode ??
    profile.config?.scenarioMode ??
    LAB_DEFAULTS.scenarioMode
  const scenariosPerOrganism =
    options.scenariosPerOrganism ??
    profile.config?.scenariosPerOrganism ??
    LAB_DEFAULTS.scenariosPerOrganism
  const scenarioMaxTicks =
    options.scenarioMaxTicks ??
    profile.config?.scenarioMaxTicks ??
    LAB_DEFAULTS.scenarioMaxTicks
  const evaluationSeedsPerOrganism =
    options.evaluationSeedsPerOrganism ??
    profile.config?.evaluationSeedsPerOrganism ??
    LAB_DEFAULTS.evaluationSeedsPerOrganism
  const maxTicks =
    options.maxTicks ?? profile.config?.maxTicks ?? LAB_DEFAULTS.maxTicks
  const dtMs = options.dtMs ?? profile.config?.dtMs ?? LAB_DEFAULTS.dtMs
  const analysisSeedsPerGenome =
    options.analysisSeedsPerGenome ??
    profile.config?.analysisSeedsPerGenome ??
    LAB_DEFAULTS.analysisSeedsPerGenome
  const analysisMaxTicks =
    options.analysisMaxTicks ??
    profile.config?.analysisMaxTicks ??
    LAB_DEFAULTS.analysisMaxTicks
  const weightRocks =
    options.weightRocks ??
    profile.config?.weightRocks ??
    LAB_DEFAULTS.weightRocks
  const weightAccuracy =
    options.weightAccuracy ??
    profile.config?.weightAccuracy ??
    LAB_DEFAULTS.weightAccuracy
  const weightSurvival =
    options.weightSurvival ??
    profile.config?.weightSurvival ??
    LAB_DEFAULTS.weightSurvival
  const gateFloor =
    options.gateFloor ?? profile.config?.gateFloor ?? LAB_DEFAULTS.gateFloor
  const actionLow =
    options.actionLow ?? profile.config?.actionLow ?? LAB_DEFAULTS.actionLow
  const actionHigh =
    options.actionHigh ?? profile.config?.actionHigh ?? LAB_DEFAULTS.actionHigh
  const actionSteepness =
    options.actionSteepness ??
    profile.config?.actionSteepness ??
    LAB_DEFAULTS.actionSteepness
  const turnGateFloor =
    options.turnGateFloor ??
    profile.config?.turnGateFloor ??
    LAB_DEFAULTS.turnGateFloor
  const turnLow =
    options.turnLow ?? profile.config?.turnLow ?? LAB_DEFAULTS.turnLow
  const turnHigh =
    options.turnHigh ?? profile.config?.turnHigh ?? LAB_DEFAULTS.turnHigh
  const turnSteepness =
    options.turnSteepness ??
    profile.config?.turnSteepness ??
    LAB_DEFAULTS.turnSteepness
  const scenarioWeight =
    options.scenarioWeight ??
    profile.config?.scenarioWeight ??
    LAB_DEFAULTS.scenarioWeight
  const scenarioSeedsPerOrganism =
    options.scenarioSeedsPerOrganism ??
    profile.config?.scenarioSeedsPerOrganism ??
    LAB_DEFAULTS.scenarioSeedsPerOrganism
  const fullGameSeedsPerOrganism =
    options.fullGameSeedsPerOrganism ??
    profile.config?.fullGameSeedsPerOrganism ??
    LAB_DEFAULTS.fullGameSeedsPerOrganism

  const experimentDir = resolve(PACKAGE_ROOT, '.artifacts', 'lab', experimentId)
  await mkdir(experimentDir, { recursive: true })

  const config: LabConfig = {
    experimentId,
    method,
    iterations,
    populationSize,
    baseSeed,
    scenarioMode,
    scenariosPerOrganism,
    scenarioMaxTicks,
    evaluationSeedsPerOrganism,
    maxTicks,
    dtMs,
    analysisSeedsPerGenome,
    analysisMaxTicks,
    weightRocks,
    weightAccuracy,
    weightSurvival,
    gateFloor,
    actionLow,
    actionHigh,
    actionSteepness,
    turnGateFloor,
    turnLow,
    turnHigh,
    turnSteepness,
    scenarioWeight,
    scenarioSeedsPerOrganism,
    fullGameSeedsPerOrganism,
    profilePath: options.profilePath,
  }

  // Save config snapshot
  await writeFile(
    join(experimentDir, 'config.json'),
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8'
  )

  console.log(`\nLab experiment: ${experimentId}`)
  console.log(`Output: ${experimentDir}`)
  console.log(
    `Method: ${method}, Iterations: ${iterations}, Population: ${populationSize}`
  )
  console.log('')

  // Phase 1: Train
  console.log('Phase 1: Training...')
  const trainResult = await train({
    method,
    iterations,
    populationSize,
    baseSeed,
    maxTicks,
    dtMs,
    evaluationSeedsPerOrganism,
    outputDir: experimentDir,
    scenarioMode,
    scenariosPerOrganism,
    scenarioMaxTicks,
    secondsLimit: options.secondsLimit,
    earlyStopPatience: options.earlyStopPatience,
    logInterval: options.logInterval,
    threadCount: options.threadCount,
    fitnessWeights: {
      rocksDestroyed: weightRocks,
      accuracy: weightAccuracy,
      survival: weightSurvival,
    },
    gateConfig: {
      floor: gateFloor,
      actionLow,
      actionHigh,
      actionSteepness,
      turnFloor: turnGateFloor,
      turnLow,
      turnHigh,
      turnSteepness,
    },
    scenarioWeight,
    scenarioSeedsPerOrganism,
    fullGameSeedsPerOrganism,
  })

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

  const behaviors = await analyzeGenomes({
    genomePaths: genomeFiles,
    method,
    seedsPerGenome: analysisSeedsPerGenome,
    maxTicks: analysisMaxTicks,
    dtMs,
    baseSeed,
    scoringMethods: profile.scoringMethods,
    onProgress: (completed, total) => {
      process.stdout.write(`\r  Analyzing genome ${completed}/${total}...`)
    },
  })
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
