/**
 * Generate scenario snapshots for scenario-based training.
 *
 * Plays games with an agent, captures state before each player death,
 * and writes the resulting scenario bank to a JSON file.
 *
 * Modes:
 *   adversarial  — Runs a lab experiment (train + analyze) using the default
 *                  profile, then replays the best genome to capture scenarios
 *                  at moments before the trained agent dies. (default)
 *   random       — Uses randomAgent (fast, no training needed).
 *
 * Usage:
 *   node packages/hexagonoids-demo/scripts/generate-scenarios.js [options]
 *
 * Options:
 *   --mode <random|adversarial>   Generation mode (default: adversarial)
 *   --genome <path|latest>        Path to a pre-trained genome JSON, or "latest" (skips lab)
 *   --count <n>                   Number of scenarios to generate (default: 100)
 *   --seed <seed>                 Base seed for determinism (default: scenario-gen)
 *   --rewind <frames>            Frames to rewind before death (default: 30)
 *   --max-games <n>              Max games to play (default: 500)
 *   --no-prune                    Disable IQR outlier pruning (adversarial only)
 *   --output <path>              Output JSON path
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')
const repoRoot = resolve(packageRoot, '../..')

/**
 * Resolve `--genome` value. Supports `'latest'` to find the most recent
 * best-*.json in `.artifacts/lab/`, falling back to repo-root `.artifacts/lab/`.
 */
function resolveGenomePath(value) {
  if (value !== 'latest') {
    return resolve(value)
  }

  // Search package-root first, then repo-root (for runs created before the path fix)
  for (const root of [packageRoot, repoRoot]) {
    const labDir = resolve(root, '.artifacts/lab')
    if (!existsSync(labDir)) continue

    const experiments = readdirSync(labDir)
      .filter((d) => !d.startsWith('.'))
      .sort()

    // Walk from newest to oldest
    for (let i = experiments.length - 1; i >= 0; i--) {
      const expDir = join(labDir, experiments[i])
      const bestFiles = readdirSync(expDir).filter(
        (f) => f.startsWith('best-') && f.endsWith('.json')
      )
      if (bestFiles.length > 0) {
        return join(expDir, bestFiles[0])
      }
    }
  }

  throw new Error(
    'No genome found for --genome latest. Run a lab experiment first.'
  )
}

function parseArgs(argv) {
  const options = {
    mode: 'adversarial',
    genome: undefined,
    count: 100,
    seed: 'scenario-gen',
    rewind: 30,
    maxGames: 500,
    prune: true,
    output: resolve(packageRoot, 'src/data/scenarios.json'),
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--mode' && argv[i + 1]) options.mode = argv[++i]
    else if (arg === '--genome' && argv[i + 1]) options.genome = argv[++i]
    else if (arg === '--count' && argv[i + 1]) options.count = Number(argv[++i])
    else if (arg === '--seed' && argv[i + 1]) options.seed = argv[++i]
    else if (arg === '--rewind' && argv[i + 1])
      options.rewind = Number(argv[++i])
    else if (arg === '--max-games' && argv[i + 1])
      options.maxGames = Number(argv[++i])
    else if (arg === '--output' && argv[i + 1]) options.output = argv[++i]
    else if (arg === '--no-prune') options.prune = false
  }
  return options
}

/**
 * Run a lab experiment and return the path to the best genome file.
 * Uses the default profile (auto-loaded by the CLI) for training params.
 */
function runLabForGenome(options) {
  const cliPath = resolve(packageRoot, 'bin/index.js')

  console.log(`\n── Running lab experiment ──\n`)

  const args = [cliPath, 'lab', '--baseSeed', options.seed]

  execFileSync(process.execPath, args, {
    stdio: 'inherit',
    cwd: repoRoot,
  })

  // Find the most recent lab experiment directory
  const labDir = resolve(packageRoot, '.artifacts/lab')
  if (!existsSync(labDir)) {
    throw new Error(`Lab output directory not found: ${labDir}`)
  }

  const experiments = readdirSync(labDir)
    .filter((d) => !d.startsWith('.'))
    .sort()

  if (experiments.length === 0) {
    throw new Error('No lab experiments found.')
  }

  const latestExperiment = experiments[experiments.length - 1]
  const experimentDir = join(labDir, latestExperiment)

  // Look for best-*.json in the experiment directory
  const bestFiles = readdirSync(experimentDir).filter(
    (f) => f.startsWith('best-') && f.endsWith('.json')
  )

  if (bestFiles.length === 0) {
    throw new Error(`No best genome found in ${experimentDir}`)
  }

  const genomePath = join(experimentDir, bestFiles[0])
  console.log(`\n── Lab complete. Best genome: ${genomePath} ──\n`)
  return genomePath
}

/**
 * Load a trained genome and return agent + executor for scenario generation.
 */
async function loadTrainedAgent(genomePath) {
  const { createNodeEvolutionManager, loadGenome } = await import(
    '@heygrady/hexagonoids-demo/node'
  )
  const { neatAgent } = await import('@heygrady/hexagonoids-environment')

  const manager = createNodeEvolutionManager({ method: 'HyperNEAT' })
  const serialized = loadGenome(genomePath)
  const organism = manager.createOrganism('HyperNEAT', serialized)
  const executor = manager.organismToExecutor(organism)

  return { agent: neatAgent, executor }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.mode !== 'random' && options.mode !== 'adversarial') {
    console.error(
      `Unknown mode: "${options.mode}". Use "random" or "adversarial".`
    )
    process.exit(1)
  }

  console.log(
    `\n=== Scenario Generation (${options.mode}): count=${options.count} seed="${options.seed}" rewind=${options.rewind} maxGames=${options.maxGames} ===\n`
  )

  // Import from environment package (built dist)
  const { generateScenarios } = await import(
    '@heygrady/hexagonoids-environment/node'
  )

  // Resolve genome path (for generation agent in adversarial mode, or analysis-only in random mode)
  let genomePath
  if (options.mode === 'adversarial') {
    genomePath =
      options.genome != null
        ? resolveGenomePath(options.genome)
        : runLabForGenome(options)
  } else if (options.genome != null) {
    // Random mode with --genome: use genome for quality analysis/pruning only
    genomePath = resolveGenomePath(options.genome)
    console.log(`Using genome for quality analysis: ${genomePath}`)
  }

  // Prepare agent options for scenario generation
  let generationAgent = {}
  if (options.mode === 'adversarial') {
    if (options.genome != null) {
      console.log(`Using pre-trained genome: ${genomePath}`)
    }
    const { agent, executor } = await loadTrainedAgent(genomePath)
    generationAgent = { agent, executor }
  }

  const startTime = performance.now()
  let scenarios = generateScenarios({
    count: options.count,
    baseSeed: options.seed,
    rewindFrames: options.rewind,
    maxGames: options.maxGames,
    ...generationAgent,
  })
  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)

  console.log(`Generated ${scenarios.length} scenarios in ${elapsed}s`)

  // Summary statistics
  if (scenarios.length > 0) {
    const difficulties = scenarios.map((s) => s.difficulty)
    const waves = scenarios.map((s) => s.wave)
    const rockCounts = scenarios.map((s) => s.rocks.length)

    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
    const min = (arr) => Math.min(...arr)
    const max = (arr) => Math.max(...arr)

    console.log(`\n── Difficulty ──`)
    console.log(
      `  min=${min(difficulties).toFixed(3)}  max=${max(difficulties).toFixed(3)}  avg=${avg(difficulties).toFixed(3)}`
    )

    console.log(`\n── Waves ──`)
    const waveCounts = {}
    for (const w of waves) {
      waveCounts[w] = (waveCounts[w] || 0) + 1
    }
    for (const [wave, count] of Object.entries(waveCounts).sort(
      (a, b) => Number(a[0]) - Number(b[0])
    )) {
      console.log(`  wave ${wave}: ${count} scenarios`)
    }

    console.log(`\n── Rocks per scenario ──`)
    console.log(
      `  min=${min(rockCounts)}  max=${max(rockCounts)}  avg=${avg(rockCounts).toFixed(1)}`
    )
  }

  // Run quality analysis and optional pruning if we have a genome
  // Load analysis agent from genome (reuse generation agent if available, otherwise load fresh)
  let analysisAgent =
    generationAgent.executor != null ? generationAgent : undefined
  if (analysisAgent == null && genomePath != null) {
    const { agent, executor } = await loadTrainedAgent(genomePath)
    analysisAgent = { agent, executor }
  }

  // Instant-death filter: reject scenarios where random agent dies within
  // the rewind window in 100% of trials
  if (scenarios.length > 0) {
    const INSTANT_DEATH_TRIALS = 10
    const { simulateScenario: simScenario, randomAgent: randAgent } =
      await import('@heygrady/hexagonoids-environment')

    const instantDeathTicks = Math.min(Math.ceil(options.rewind * 1.5), 30)
    const rewindConfig = { maxTicks: instantDeathTicks, dtMs: 33 }
    let instantDeathCount = 0

    for (let i = scenarios.length - 1; i >= 0; i--) {
      const scenario = scenarios[i]
      let allDied = true

      for (let t = 0; t < INSTANT_DEATH_TRIALS; t++) {
        const metrics = simScenario(
          randAgent,
          scenario,
          rewindConfig,
          `instant-death-${i}-${t}`
        )
        if (metrics.deaths === 0) {
          allDied = false
          break
        }
      }

      if (allDied) {
        scenarios.splice(i, 1)
        instantDeathCount++
      }
    }

    if (instantDeathCount > 0) {
      console.log(
        `\n── Instant-death filter (ticks=${instantDeathTicks}, rewind=${options.rewind}, trials=${INSTANT_DEATH_TRIALS}) ──`
      )
      console.log(`  removed: ${instantDeathCount}  kept: ${scenarios.length}`)
    }
  }

  if (analysisAgent != null && scenarios.length > 0) {
    console.log(`\n── Quality Analysis (${scenarios.length} scenarios) ──`)
    const {
      simulateScenario,
      weightedFitnessSum,
      scenarioMaximums,
      scenarioPossibleDeaths,
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
    } = await import('@heygrady/hexagonoids-environment')

    const { fitnessWeights, gateConfig, simulation } =
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG
    const scenarioConfig = { ...simulation, maxTicks: 120 }

    const fitnesses = []
    let totalDeaths = 0
    let zeroRocks = 0
    let impossible = 0

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i]
      const metrics = simulateScenario(
        analysisAgent.agent,
        scenario,
        scenarioConfig,
        `gen-analyze-${i}`,
        analysisAgent.executor
      )
      const context = {
        possibleDeaths: scenarioPossibleDeaths(
          scenario.player.lives,
          120,
          simulation.dtMs
        ),
        ...scenarioMaximums(scenario.rocks),
      }
      const fitness = weightedFitnessSum(
        metrics,
        fitnessWeights,
        gateConfig,
        context
      )
      fitnesses.push(fitness)
      totalDeaths += metrics.deaths
      if (metrics.rocksDestroyed === 0) zeroRocks++
      if (fitness < 0.01) impossible++
    }

    const avgFit = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length
    const meanSq =
      fitnesses.reduce((a, f) => a + (f - avgFit) ** 2, 0) / fitnesses.length
    const stddev = Math.sqrt(meanSq)

    console.log(
      `  fitness: mean=${avgFit.toFixed(4)}  stddev=${stddev.toFixed(4)}  min=${Math.min(...fitnesses).toFixed(4)}  max=${Math.max(...fitnesses).toFixed(4)}`
    )
    console.log(
      `  deaths: ${totalDeaths}/${scenarios.length}  zero-rocks: ${zeroRocks}/${scenarios.length} (${((zeroRocks / scenarios.length) * 100).toFixed(0)}%)  too-hard: ${impossible}/${scenarios.length} (${((impossible / scenarios.length) * 100).toFixed(0)}%)`
    )

    // Compact fitness histogram
    const bins = 5
    const counts = new Array(bins).fill(0)
    for (const f of fitnesses) {
      counts[Math.min(Math.floor(f * bins), bins - 1)]++
    }
    const maxCount = Math.max(...counts)
    console.log(`  distribution:`)
    for (let i = 0; i < bins; i++) {
      const lo = (i / bins).toFixed(1)
      const hi = ((i + 1) / bins).toFixed(1)
      const bar = '█'.repeat(Math.round((counts[i] / maxCount) * 30))
      console.log(`    ${lo}-${hi}: ${bar} ${counts[i]}`)
    }

    // IQR-based outlier pruning
    if (options.prune) {
      const sorted = [...fitnesses].sort((a, b) => a - b)
      const q1 = sorted[Math.floor(sorted.length * 0.25)]
      const q3 = sorted[Math.floor(sorted.length * 0.75)]
      const iqr = q3 - q1
      const HARD_FLOOR = 0.01
      const lowerFence = Math.max(q1 - 1.5 * iqr, HARD_FLOOR)
      const upperFence = q3 + 1.5 * iqr

      const beforeCount = scenarios.length
      const kept = []
      let removedLow = 0
      let removedHigh = 0
      for (let i = 0; i < scenarios.length; i++) {
        if (fitnesses[i] < lowerFence) {
          removedLow++
        } else if (fitnesses[i] > upperFence) {
          removedHigh++
        } else {
          kept.push(scenarios[i])
        }
      }

      const totalRemoved = removedLow + removedHigh
      console.log(`\n── Pruning (IQR fencing + hard floor) ──`)
      console.log(
        `  fences: [${lowerFence.toFixed(4)}, ${upperFence.toFixed(4)}]  IQR=${iqr.toFixed(4)}  floor=${HARD_FLOOR}`
      )
      console.log(
        `  removed: ${totalRemoved}/${beforeCount} (${removedLow} too hard, ${removedHigh} too easy)`
      )
      console.log(`  kept: ${kept.length} scenarios`)

      scenarios = kept
    }
  }

  // Write output
  const outputPath = resolve(options.output)
  writeFileSync(outputPath, JSON.stringify(scenarios, null, 2))
  console.log(`\nWritten ${scenarios.length} scenarios to: ${outputPath}`)

  console.log(`\n=== Done ===\n`)
}

main().catch((error) => {
  console.error('generate-scenarios failed:', error)
  process.exit(1)
})
