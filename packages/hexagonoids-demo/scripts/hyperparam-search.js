/**
 * Hyperparameter search script for training hyperparameters.
 *
 * Modes:
 *   --mode lhs      (default) Latin Hypercube Sampling search for fitness weights/gate config.
 *   --mode budget   Sweep scenariosPerOrganism × fullGameSeedsPerOrganism to find
 *                   cheapest budget that doesn't degrade quality.
 *
 * Usage:
 *   node packages/hexagonoids-demo/scripts/hyperparam-search.js [--mode lhs] [--candidates <N>] [--trials <N>]
 *   node packages/hexagonoids-demo/scripts/hyperparam-search.js --mode budget
 */
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')
const profilesDir = resolve(packageRoot, '.artifacts/profiles')
const defaultProfilePath = resolve(profilesDir, 'default.json')

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const options = { candidates: 5, mode: 'lhs', trials: 2 }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--candidates' && argv[i + 1]) {
      options.candidates = Number(argv[++i])
    } else if (arg === '--mode' && argv[i + 1]) {
      options.mode = argv[++i]
    } else if (arg === '--trials' && argv[i + 1]) {
      options.trials = Math.min(5, Math.max(1, Number(argv[++i])))
    }
  }
  return options
}

// ---------------------------------------------------------------------------
// Search space — all tunable params
// ---------------------------------------------------------------------------
const SEARCH_SPACE = [
  // Fitness weights (renormalized to sum=1 after sampling)
  { key: 'weightRocks', min: 0.05, max: 0.9, scale: 'linear' },
  { key: 'weightAccuracy', min: 0.05, max: 0.9, scale: 'linear' },
  { key: 'weightSurvival', min: 0.01, max: 0.9, scale: 'linear' },
  // Action gate
  { key: 'gateFloor', min: 0.1, max: 0.8, scale: 'linear' },
  { key: 'actionLow', min: 0.01, max: 0.3, scale: 'linear' },
  { key: 'actionHigh', min: 0.2, max: 0.9, scale: 'linear' },
  { key: 'actionSteepness', min: 1.0, max: 25.0, scale: 'linear' },
  // Turn gate
  { key: 'turnGateFloor', min: 0.01, max: 0.5, scale: 'linear' },
  { key: 'turnLow', min: 0.01, max: 0.3, scale: 'linear' },
  { key: 'turnHigh', min: 0.3, max: 1.0, scale: 'linear' },
  { key: 'turnSteepness', min: 1.0, max: 25.0, scale: 'linear' },
  // Scenario weighting
  { key: 'scenarioWeight', min: 0.0, max: 1.0, scale: 'linear' },
]

/** Keys that are tuned by the search (used for merge-save). */
const TUNED_KEYS = SEARCH_SPACE.map((s) => s.key)

// ---------------------------------------------------------------------------
// loadBaseline — read default.json or use hardcoded defaults
// ---------------------------------------------------------------------------
function loadBaseline(envDefaults) {
  const defaults = {
    weightRocks: envDefaults.fitnessWeights.rocksDestroyed,
    weightAccuracy: envDefaults.fitnessWeights.accuracy,
    weightSurvival: envDefaults.fitnessWeights.survival,
    gateFloor: envDefaults.gateConfig.floor,
    actionLow: envDefaults.gateConfig.actionLow,
    actionHigh: envDefaults.gateConfig.actionHigh,
    actionSteepness: envDefaults.gateConfig.actionSteepness,
    turnGateFloor: envDefaults.gateConfig.turnFloor,
    turnLow: envDefaults.gateConfig.turnLow,
    turnHigh: envDefaults.gateConfig.turnHigh,
    turnSteepness: envDefaults.gateConfig.turnSteepness,
    scenarioWeight: envDefaults.scenarioWeight,
  }

  if (existsSync(defaultProfilePath)) {
    try {
      const raw = JSON.parse(readFileSync(defaultProfilePath, 'utf-8'))
      return {
        weightRocks: raw.weightRocks ?? defaults.weightRocks,
        weightAccuracy: raw.weightAccuracy ?? defaults.weightAccuracy,
        weightSurvival: raw.weightSurvival ?? defaults.weightSurvival,
        gateFloor: raw.gateFloor ?? raw.actionGateFloor ?? defaults.gateFloor,
        actionLow: raw.actionLow ?? defaults.actionLow,
        actionHigh: raw.actionHigh ?? defaults.actionHigh,
        actionSteepness: raw.actionSteepness ?? defaults.actionSteepness,
        turnGateFloor: raw.turnGateFloor ?? defaults.turnGateFloor,
        turnLow: raw.turnLow ?? defaults.turnLow,
        turnHigh: raw.turnHigh ?? defaults.turnHigh,
        turnSteepness: raw.turnSteepness ?? defaults.turnSteepness,
        scenarioWeight: raw.scenarioWeight ?? defaults.scenarioWeight,
      }
    } catch {
      // Fall through to defaults
    }
  }

  return defaults
}

// ---------------------------------------------------------------------------
// Latin Hypercube Sampling — structured coverage of the search space
// ---------------------------------------------------------------------------

/**
 * Generate N candidates using Latin Hypercube Sampling.
 * Candidate 0 is always the unperturbed baseline.
 * Candidates 1..N-1 are LHS-sampled across each param's [min, max].
 * Fitness weights are renormalized after sampling.
 */
function generateCandidatesLHS(baseline, count) {
  const candidates = [{ ...baseline }] // Candidate 0 = unperturbed baseline

  if (count <= 1) return candidates

  const n = count - 1 // Number of LHS samples

  // For each param, create n strata and sample one point per stratum
  // Then shuffle the assignment across candidates (Fisher-Yates)
  const paramSamples = SEARCH_SPACE.map(({ min, max }) => {
    const samples = []
    for (let i = 0; i < n; i++) {
      // Sample uniformly within stratum [i/n, (i+1)/n]
      const u = (i + Math.random()) / n
      samples.push(min + u * (max - min))
    }
    // Shuffle (Fisher-Yates)
    for (let i = samples.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[samples[i], samples[j]] = [samples[j], samples[i]]
    }
    return samples
  })

  for (let ci = 0; ci < n; ci++) {
    const candidate = { ...baseline }
    for (let pi = 0; pi < SEARCH_SPACE.length; pi++) {
      candidate[SEARCH_SPACE[pi].key] = paramSamples[pi][ci]
    }

    // Renormalize fitness weights to sum to 1.0
    const weightSum =
      candidate.weightRocks +
      candidate.weightAccuracy +
      candidate.weightSurvival
    if (weightSum > 0) {
      candidate.weightRocks /= weightSum
      candidate.weightAccuracy /= weightSum
      candidate.weightSurvival /= weightSum
    }

    candidates.push(candidate)
  }

  return candidates
}

// ---------------------------------------------------------------------------
// evaluateCandidate — train (fast) + analyzeGenomes (gauntlet) → productionFitness
// ---------------------------------------------------------------------------
function buildGateConfig(candidate) {
  return {
    floor: candidate.gateFloor,
    actionLow: candidate.actionLow,
    actionHigh: candidate.actionHigh,
    actionSteepness: candidate.actionSteepness,
    turnFloor: candidate.turnGateFloor,
    turnLow: candidate.turnLow,
    turnHigh: candidate.turnHigh,
    turnSteepness: candidate.turnSteepness,
  }
}

async function evaluateCandidate(
  candidate,
  index,
  outputDir,
  train,
  analyzeGenomes,
  trials
) {
  const candidateDir = join(outputDir, `candidate-${index}`)
  await mkdir(candidateDir, { recursive: true })

  // Save candidate params
  await writeFile(
    join(candidateDir, 'params.json'),
    JSON.stringify(candidate, null, 2) + '\n',
    'utf8'
  )

  const trialResults = []

  for (let t = 0; t < trials; t++) {
    const trialDir =
      trials > 1 ? join(candidateDir, `trial-${t}`) : candidateDir
    if (trials > 1) await mkdir(trialDir, { recursive: true })

    const trialSeed = `hyperparam-${index}-trial${t}`

    // Fast training
    console.log(
      `  Training candidate ${index}${trials > 1 ? ` trial ${t}` : ''}...`
    )
    const trainResult = await train({
      method: 'HyperNEAT',
      iterations: 15,
      populationSize: 64,
      scenarioMode: true,
      scenariosPerOrganism: 10,
      scenarioMaxTicks: 120,
      maxTicks: 1000,
      evaluationSeedsPerOrganism: 1,
      scenarioSeedsPerOrganism: 1,
      fullGameSeedsPerOrganism: 4,
      outputDir: trialDir,
      fitnessWeights: {
        rocksDestroyed: candidate.weightRocks,
        accuracy: candidate.weightAccuracy,
        survival: candidate.weightSurvival,
      },
      gateConfig: buildGateConfig(candidate),
      scenarioWeight: candidate.scenarioWeight,
      baselineOnly: false,
      seed: trialSeed,
    })

    if (trainResult.mode !== 'training') {
      throw new Error(
        `Candidate ${index} trial ${t}: expected training mode result.`
      )
    }

    console.log(
      `  Candidate ${index}${trials > 1 ? ` trial ${t}` : ''} training done. Best fitness: ${trainResult.bestFitness.toFixed(4)}`
    )

    // Find genome files for analysis gauntlet
    const { readdir } = await import('node:fs/promises')
    const genomesDir = join(trialDir, 'genomes')
    let genomeFiles = []
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
      console.log(
        `  Candidate ${index}${trials > 1 ? ` trial ${t}` : ''}: no genomes found, skipping analysis.`
      )
      trialResults.push({
        productionFitness: 0,
        trainingFitness: trainResult.bestFitness,
      })
      continue
    }

    // Use only the best genome (last generation)
    const bestGenomePath = genomeFiles[genomeFiles.length - 1]

    // Analysis gauntlet — uses fixed default weights for fair cross-candidate comparison
    console.log(
      `  Analyzing candidate ${index}${trials > 1 ? ` trial ${t}` : ''} best genome...`
    )
    const behaviors = await analyzeGenomes({
      genomePaths: [bestGenomePath],
      method: 'HyperNEAT',
      seedsPerGenome: 8,
      maxTicks: 3000,
      dtMs: 33,
      baseSeed: `hyperparam-search-gauntlet-${trialSeed}`,
    })

    const productionFitness = behaviors[0]?.scoring?.productionFitness ?? 0

    console.log(
      `  Candidate ${index}${trials > 1 ? ` trial ${t}` : ''} productionFitness: ${productionFitness.toFixed(4)}`
    )

    trialResults.push({
      productionFitness,
      trainingFitness: trainResult.bestFitness,
    })
  }

  // Compute mean and stddev across trials
  const meanProd =
    trialResults.reduce((s, r) => s + r.productionFitness, 0) /
    trialResults.length
  const meanTrain =
    trialResults.reduce((s, r) => s + r.trainingFitness, 0) /
    trialResults.length

  let stddevProd = 0
  if (trialResults.length > 1) {
    const variance =
      trialResults.reduce(
        (s, r) => s + (r.productionFitness - meanProd) ** 2,
        0
      ) /
      (trialResults.length - 1)
    stddevProd = Math.sqrt(variance)
  }

  return {
    candidate,
    index,
    productionFitness: meanProd,
    productionFitnessStddev: stddevProd,
    trainingFitness: meanTrain,
    trials: trialResults,
  }
}

// ---------------------------------------------------------------------------
// Budget search — sweep scenariosPerOrganism × fullGameSeedsPerOrganism
// ---------------------------------------------------------------------------
const BUDGET_GRID = [
  { scenariosPerOrganism: 10, fullGameSeedsPerOrganism: 2 },
  { scenariosPerOrganism: 20, fullGameSeedsPerOrganism: 4 },
  { scenariosPerOrganism: 40, fullGameSeedsPerOrganism: 8 },
  { scenariosPerOrganism: 80, fullGameSeedsPerOrganism: 16 },
]

async function evaluateBudgetCandidate(
  budgetConfig,
  index,
  outputDir,
  baseline,
  train,
  analyzeGenomes
) {
  const candidateDir = join(outputDir, `budget-${index}`)
  await mkdir(candidateDir, { recursive: true })

  // Save budget params
  await writeFile(
    join(candidateDir, 'params.json'),
    JSON.stringify({ ...baseline, ...budgetConfig }, null, 2) + '\n',
    'utf8'
  )

  // Fast training with fixed weights/gate + variable budget
  console.log(
    `  Training budget ${index} (scenarios=${budgetConfig.scenariosPerOrganism}, fullGames=${budgetConfig.fullGameSeedsPerOrganism})...`
  )
  const startTime = Date.now()
  const trainResult = await train({
    method: 'HyperNEAT',
    iterations: 15,
    populationSize: 64,
    scenarioMode: true,
    scenariosPerOrganism: budgetConfig.scenariosPerOrganism,
    scenarioMaxTicks: 120,
    maxTicks: 1000,
    evaluationSeedsPerOrganism: 1,
    scenarioSeedsPerOrganism: 1,
    fullGameSeedsPerOrganism: budgetConfig.fullGameSeedsPerOrganism,
    outputDir: candidateDir,
    fitnessWeights: {
      rocksDestroyed: baseline.weightRocks,
      accuracy: baseline.weightAccuracy,
      survival: baseline.weightSurvival,
    },
    gateConfig: buildGateConfig(baseline),
    scenarioWeight: baseline.scenarioWeight,
    baselineOnly: false,
  })
  const trainingSeconds = (Date.now() - startTime) / 1000

  if (trainResult.mode !== 'training') {
    throw new Error(`Budget ${index}: expected training mode result.`)
  }

  console.log(
    `  Budget ${index} training done in ${trainingSeconds.toFixed(1)}s. Best fitness: ${trainResult.bestFitness.toFixed(4)}`
  )

  // Find genome files for analysis gauntlet
  const { readdir } = await import('node:fs/promises')
  const genomesDir = join(candidateDir, 'genomes')
  let genomeFiles = []
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
    console.log(`  Budget ${index}: no genomes found, skipping analysis.`)
    return { budgetConfig, index, productionFitness: 0, trainingSeconds }
  }

  const bestGenomePath = genomeFiles[genomeFiles.length - 1]

  console.log(`  Analyzing budget ${index} best genome...`)
  const behaviors = await analyzeGenomes({
    genomePaths: [bestGenomePath],
    method: 'HyperNEAT',
    seedsPerGenome: 8,
    maxTicks: 3000,
    dtMs: 33,
    baseSeed: 'hyperparam-search-gauntlet',
  })

  const productionFitness = behaviors[0]?.scoring?.productionFitness ?? 0

  console.log(
    `  Budget ${index} productionFitness: ${productionFitness.toFixed(4)}`
  )

  return { budgetConfig, index, productionFitness, trainingSeconds }
}

async function runBudgetSearch(options, train, analyzeGenomes, envDefaults) {
  const baseline = loadBaseline(envDefaults)

  console.log(`\n=== Budget Search ===`)
  console.log(`Budget levels: ${BUDGET_GRID.length}`)
  console.log('Baseline weights/gate:', baseline)
  console.log()

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const runDir = resolve(
    packageRoot,
    `.artifacts/hyperparam-search/budget-${timestamp}`
  )
  await mkdir(runDir, { recursive: true })

  await writeFile(
    join(runDir, 'grid.json'),
    JSON.stringify(BUDGET_GRID, null, 2) + '\n',
    'utf8'
  )

  console.log(`Output: ${runDir}`)
  console.log()

  const results = []
  for (let i = 0; i < BUDGET_GRID.length; i++) {
    console.log(`\n--- Budget ${i + 1}/${BUDGET_GRID.length} ---`)
    const result = await evaluateBudgetCandidate(
      BUDGET_GRID[i],
      i,
      runDir,
      baseline,
      train,
      analyzeGenomes
    )
    results.push(result)
  }

  // Save results
  await writeFile(
    join(runDir, 'results.json'),
    JSON.stringify(results, null, 2) + '\n',
    'utf8'
  )

  // Print comparison table
  console.log(`\n${'═'.repeat(72)}`)
  console.log('Budget Comparison:')
  console.log(
    'Budget | scenarios | fullGames | trainSec | prodFitness | fitness/sec'
  )
  console.log(
    '-------|-----------|-----------|----------|-------------|------------'
  )
  for (const r of results) {
    const efficiency =
      r.trainingSeconds > 0 ? r.productionFitness / r.trainingSeconds : 0
    console.log(
      `  ${String(r.index).padEnd(4)} | ${String(r.budgetConfig.scenariosPerOrganism).padStart(9)} | ${String(r.budgetConfig.fullGameSeedsPerOrganism).padStart(9)} | ${r.trainingSeconds.toFixed(0).padStart(7)}s | ${r.productionFitness.toFixed(4).padStart(11)} | ${efficiency.toFixed(5).padStart(10)}`
    )
  }

  console.log(`\n=== Done ===\n`)
}

// ---------------------------------------------------------------------------
// LHS search — Latin Hypercube Sampling exploration
// ---------------------------------------------------------------------------

/**
 * Format a comparison table of all candidates with their tuned params.
 */
function printComparisonTable(results, baseline) {
  // Header
  const paramCols = SEARCH_SPACE.map((s) => ({
    key: s.key,
    width: Math.max(s.key.length, 8),
  }))

  // Print header row
  const header =
    'Cand | ' +
    paramCols.map((c) => c.key.padStart(c.width)).join(' | ') +
    ' | trainFit | prodFit±std  | delta'
  console.log(header)
  console.log('-'.repeat(header.length))

  const baselineProd = results[0]?.productionFitness ?? 0

  for (const r of results) {
    const isBaseline = r.index === 0
    const delta = r.productionFitness - baselineProd
    const deltaStr = isBaseline
      ? '  base'
      : `${delta >= 0 ? '+' : ''}${delta.toFixed(4)}`

    const stdStr =
      r.productionFitnessStddev > 0
        ? `±${r.productionFitnessStddev.toFixed(3)}`
        : ''
    const prodStr = `${r.productionFitness.toFixed(4)}${stdStr}`

    const paramValues = paramCols
      .map((c) => {
        const val = r.candidate[c.key]
        return val != null
          ? val.toFixed(3).padStart(c.width)
          : ''.padStart(c.width)
      })
      .join(' | ')

    console.log(
      `${String(r.index).padStart(4)} | ${paramValues} | ${r.trainingFitness.toFixed(4).padStart(8)} | ${prodStr.padStart(12)} | ${deltaStr}`
    )
  }
}

async function runLhsSearch(options, train, analyzeGenomes, envDefaults) {
  const baseline = loadBaseline(envDefaults)

  console.log(`\n=== Hyperparameter Search (LHS) ===`)
  console.log(`Candidates: ${options.candidates}, Trials: ${options.trials}`)
  console.log('Baseline params:', baseline)
  console.log()

  const candidates = generateCandidatesLHS(baseline, options.candidates)

  // Create run output directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const runDir = resolve(
    packageRoot,
    `.artifacts/hyperparam-search/run-${timestamp}`
  )
  await mkdir(runDir, { recursive: true })

  // Save all candidate params
  await writeFile(
    join(runDir, 'candidates.json'),
    JSON.stringify(candidates, null, 2) + '\n',
    'utf8'
  )

  console.log(`Output: ${runDir}`)
  console.log()

  // Evaluate each candidate
  const results = []
  for (let i = 0; i < candidates.length; i++) {
    console.log(`\n--- Candidate ${i + 1}/${candidates.length} ---`)
    const result = await evaluateCandidate(
      candidates[i],
      i,
      runDir,
      train,
      analyzeGenomes,
      options.trials
    )
    results.push(result)
  }

  // Save all results
  await writeFile(
    join(runDir, 'results.json'),
    JSON.stringify(results, null, 2) + '\n',
    'utf8'
  )

  // Print comparison table
  console.log(`\n${'═'.repeat(60)}`)
  console.log('Results:')
  console.log()
  printComparisonTable(results, baseline)

  const winner = results.reduce((best, r) =>
    r.productionFitness > best.productionFitness ? r : best
  )
  const baselineResult = results[0]

  console.log()
  console.log(
    `Winner: candidate ${winner.index} (productionFitness=${winner.productionFitness.toFixed(4)})`
  )

  // Only update default.json if winner beats baseline
  if (winner.productionFitness > baselineResult.productionFitness) {
    await mkdir(profilesDir, { recursive: true })

    // Merge only tuned keys into existing profile (preserve non-tuned settings)
    let existing = {}
    if (existsSync(defaultProfilePath)) {
      try {
        existing = JSON.parse(readFileSync(defaultProfilePath, 'utf-8'))
      } catch {
        // Start fresh if parse fails
      }
    }

    const merged = { ...existing }
    for (const key of TUNED_KEYS) {
      merged[key] = winner.candidate[key]
    }

    await writeFile(
      defaultProfilePath,
      JSON.stringify(merged, null, 2) + '\n',
      'utf8'
    )
    console.log(
      `Saved winner to ${defaultProfilePath} (merged ${TUNED_KEYS.length} tuned keys)`
    )
  } else {
    console.log('Baseline was not beaten — default.json unchanged.')
  }

  console.log(`\n=== Done ===\n`)
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const options = parseArgs(process.argv.slice(2))

  // Dynamic imports
  const env = await import('@heygrady/hexagonoids-environment')
  const { DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG } = env

  const demo = await import('@heygrady/hexagonoids-demo/node')
  const { train, analyzeGenomes } = demo

  if (options.mode === 'budget') {
    await runBudgetSearch(
      options,
      train,
      analyzeGenomes,
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG
    )
  } else if (options.mode === 'lhs') {
    await runLhsSearch(
      options,
      train,
      analyzeGenomes,
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG
    )
  } else {
    console.error(
      `Unknown mode: ${options.mode}. Use --mode lhs or --mode budget.`
    )
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('hyperparam-search failed:', error)
  process.exit(1)
})
