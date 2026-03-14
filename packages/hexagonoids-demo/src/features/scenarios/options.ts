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

export function defaultScenarioOptions(): ScenarioOptions {
  return {
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
}
