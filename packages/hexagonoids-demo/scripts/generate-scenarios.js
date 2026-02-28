/**
 * Generate scenario snapshots for scenario-based training.
 *
 * Plays games with an agent, captures state before each player death,
 * and writes the resulting scenario bank to a JSON file.
 *
 * Modes:
 *   random       — Uses randomAgent (default, fast)
 *   adversarial  — Trains a HyperNEAT agent first, then replays it to
 *                  capture scenarios at moments before the trained agent dies.
 *                  Produces scenarios that are genuinely challenging.
 *
 * Usage:
 *   node packages/hexagonoids-demo/scripts/generate-scenarios.js [options]
 *
 * Options:
 *   --mode <random|adversarial>   Generation mode (default: random)
 *   --count <n>                   Number of scenarios to generate (default: 100)
 *   --seed <seed>                 Base seed for determinism (default: scenario-gen)
 *   --rewind <frames>            Frames to rewind before death (default: 60)
 *   --max-games <n>              Max games to play (default: 500)
 *   --output <path>              Output JSON path
 *   --train-iterations <n>       Training generations (adversarial, default: 100)
 *   --train-population <n>       Population size (adversarial, default: 64)
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')
const repoRoot = resolve(packageRoot, '../..')

function parseArgs(argv) {
  const options = {
    mode: 'random',
    count: 100,
    seed: 'scenario-gen',
    rewind: 60,
    maxGames: 500,
    output: resolve(packageRoot, 'src/data/scenarios.json'),
    trainIterations: 100,
    trainPopulation: 64,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--mode' && argv[i + 1]) options.mode = argv[++i]
    else if (arg === '--count' && argv[i + 1]) options.count = Number(argv[++i])
    else if (arg === '--seed' && argv[i + 1]) options.seed = argv[++i]
    else if (arg === '--rewind' && argv[i + 1])
      options.rewind = Number(argv[++i])
    else if (arg === '--max-games' && argv[i + 1])
      options.maxGames = Number(argv[++i])
    else if (arg === '--output' && argv[i + 1]) options.output = argv[++i]
    else if (arg === '--train-iterations' && argv[i + 1])
      options.trainIterations = Number(argv[++i])
    else if (arg === '--train-population' && argv[i + 1])
      options.trainPopulation = Number(argv[++i])
  }
  return options
}

/**
 * Train a HyperNEAT agent and return the path to the best genome file.
 */
function trainAgent(options) {
  const tempDir = mkdtempSync(join(tmpdir(), 'hexagonoids-adversarial-'))
  const cliPath = resolve(packageRoot, 'bin/index.js')

  console.log(
    `\n── Training HyperNEAT agent (${options.trainIterations} generations, pop=${options.trainPopulation}) ──\n`
  )

  const args = [
    cliPath,
    'train',
    '--method',
    'HyperNEAT',
    '--scenarios',
    '--iterations',
    String(options.trainIterations),
    '--populationSize',
    String(options.trainPopulation),
    '--scenariosPerOrganism',
    '100',
    '--scenarioMaxTicks',
    '80',
    '--baseSeed',
    options.seed,
    '--outputDir',
    tempDir,
  ]

  execFileSync(process.execPath, args, {
    stdio: 'inherit',
    cwd: repoRoot,
  })

  const genomePath = join(tempDir, 'best-HyperNEAT.json')
  console.log(`\n── Training complete. Best genome: ${genomePath} ──\n`)
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

  // Prepare agent options for adversarial mode
  let agentOptions = {}
  if (options.mode === 'adversarial') {
    const genomePath = trainAgent(options)
    const { agent, executor } = await loadTrainedAgent(genomePath)
    agentOptions = { agent, executor }
  }

  const startTime = performance.now()
  const scenarios = generateScenarios({
    count: options.count,
    baseSeed: options.seed,
    rewindFrames: options.rewind,
    maxGames: options.maxGames,
    ...agentOptions,
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

  // Write output
  const outputPath = resolve(options.output)
  writeFileSync(outputPath, JSON.stringify(scenarios, null, 2))
  console.log(`\nWritten to: ${outputPath}`)
  console.log(`\n=== Done ===\n`)
}

main().catch((error) => {
  console.error('generate-scenarios failed:', error)
  process.exit(1)
})
