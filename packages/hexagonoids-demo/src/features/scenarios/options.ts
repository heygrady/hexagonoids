import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { INPUT_COUNT } from '@heygrady/hexagonoids-environment'

import type { ExpectedIoShape, ScenarioOptions } from './types.js'

function findPackageRoot() {
  let dir = dirname(fileURLToPath(import.meta.url))
  while (dir !== dirname(dir)) {
    if (existsSync(resolve(dir, 'package.json'))) return dir
    dir = dirname(dir)
  }
  throw new Error('Could not find package root')
}

export const packageRoot = findPackageRoot()
export const EXPECTED_OUTPUTS = 4
export const EXPECTED_IO: ExpectedIoShape = {
  inputs: INPUT_COUNT,
  outputs: EXPECTED_OUTPUTS,
}

export function parseScenarioArgs(argv: string[]): ScenarioOptions {
  const options: ScenarioOptions = {
    labRoot: resolve(packageRoot, '.artifacts/lab'),
    maxLabs: 5,
    heroCount: 4,
    countPerSource: 150,
    panelMax: 12,
    panelScoutCount: 48,
    rewind: 20,
    maxGames: 500,
    evalTicks: 120,
    instantDeathTrials: 8,
    randomBaselineTrials: 5,
    finalCount: 200,
    killRatio: 0.5,
    seed: 'robust-scenarios',
    output: resolve(packageRoot, 'src/data/scenarioBank.js'),
    existing: resolve(packageRoot, 'src/data/scenarioBank.js'),
    mergeExisting: true,
    report: undefined,
    dryRun: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]
    if (arg === '--lab-root' && next != null)
      options.labRoot = resolve(argv[++i] as string)
    else if (arg === '--max-labs' && next != null)
      options.maxLabs = Number(argv[++i] as string)
    else if (arg === '--hero-count' && next != null)
      options.heroCount = Number(argv[++i] as string)
    else if (arg === '--count-per-source' && next != null)
      options.countPerSource = Number(argv[++i] as string)
    else if (arg === '--panel-max' && next != null)
      options.panelMax = Number(argv[++i] as string)
    else if (arg === '--panel-scout-count' && next != null)
      options.panelScoutCount = Number(argv[++i] as string)
    else if (arg === '--rewind' && next != null)
      options.rewind = Number(argv[++i] as string)
    else if (arg === '--max-games' && next != null)
      options.maxGames = Number(argv[++i] as string)
    else if (arg === '--eval-ticks' && next != null)
      options.evalTicks = Number(argv[++i] as string)
    else if (arg === '--instant-death-trials' && next != null)
      options.instantDeathTrials = Number(argv[++i] as string)
    else if (arg === '--random-baseline-trials' && next != null)
      options.randomBaselineTrials = Number(argv[++i] as string)
    else if (arg === '--final-count' && next != null)
      options.finalCount = Number(argv[++i] as string)
    else if (arg === '--kill-ratio' && next != null)
      options.killRatio = Number(argv[++i] as string)
    else if (arg === '--seed' && next != null)
      options.seed = argv[++i] as string
    else if (arg === '--output' && next != null)
      options.output = resolve(argv[++i] as string)
    else if (arg === '--existing' && next != null)
      options.existing = resolve(argv[++i] as string)
    else if (arg === '--no-merge-existing') options.mergeExisting = false
    else if (arg === '--report' && next != null)
      options.report = resolve(argv[++i] as string)
    else if (arg === '--dry-run') options.dryRun = true
  }

  return options
}
