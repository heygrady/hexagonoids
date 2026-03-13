/**
 * Analyze scenario quality by running a trained agent through every scenario.
 *
 * Reports per-scenario metrics (fitness, survival, accuracy, rocks destroyed)
 * and aggregate statistics to help assess whether the scenario bank provides
 * good training signal.
 *
 * Usage:
 *   node packages/hexagonoids-demo/scripts/analyze-scenarios.js --genome <path> [options]
 *
 * Options:
 *   --genome <path>      Path to a trained genome JSON (required)
 *   --scenarios <path>   Path to scenario bank file (default: src/data/scenarioBank.js)
 *   --max-ticks <n>      Max ticks per scenario (default: 120)
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')

function readScenarioBank(pathname) {
  const text = readFileSync(pathname, 'utf-8')
  if (pathname.endsWith('.js')) {
    const match = text.match(/export default "([^"]+)"/)
    if (match?.[1])
      return JSON.parse(gunzipSync(Buffer.from(match[1], 'base64')).toString())
  }
  return JSON.parse(text)
}

function parseArgs(argv) {
  const options = {
    genome: undefined,
    scenarios: resolve(packageRoot, 'src/data/scenarioBank.js'),
    maxTicks: 120,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--genome' && argv[i + 1]) options.genome = argv[++i]
    else if (arg === '--scenarios' && argv[i + 1]) options.scenarios = argv[++i]
    else if (arg === '--max-ticks' && argv[i + 1])
      options.maxTicks = Number(argv[++i])
  }
  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.genome == null) {
    console.error('Usage: analyze-scenarios.js --genome <path>')
    process.exit(1)
  }

  const genomePath = resolve(options.genome)
  const scenariosPath = resolve(options.scenarios)

  console.log(`\n=== Scenario Analysis ===`)
  console.log(`Genome: ${genomePath}`)
  console.log(`Scenarios: ${scenariosPath}`)
  console.log(`Max ticks: ${options.maxTicks}`)
  console.log()

  // Load genome + create executor
  const { createNodeEvolutionManager, loadGenome } = await import(
    '@heygrady/hexagonoids-demo/node'
  )
  const {
    decodeScenarioBankDocument,
    neatAgent,
    simulateScenario,
    weightedFitnessSum,
    computePossibleDeaths,
    DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  } = await import('@heygrady/hexagonoids-environment')

  // Load scenarios
  const scenarios = decodeScenarioBankDocument(readScenarioBank(scenariosPath))
  console.log(`Loaded ${scenarios.length} scenarios`)

  const manager = createNodeEvolutionManager({ method: 'HyperNEAT' })
  const serialized = loadGenome(genomePath)
  const organism = manager.createOrganism('HyperNEAT', serialized)
  const executor = manager.organismToExecutor(organism)

  const { fitnessWeights, gateConfig, simulation } =
    DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG

  const scenarioConfig = {
    ...simulation,
    maxTicks: options.maxTicks,
  }

  // Run each scenario
  console.log(`\nRunning ${scenarios.length} scenarios...`)
  const startTime = performance.now()

  const results = []
  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i]

    const metrics = simulateScenario(
      neatAgent,
      scenario,
      scenarioConfig,
      `analyze-${i}`,
      executor
    )

    const context = {
      possibleDeaths: computePossibleDeaths(
        metrics.elapsedTicks,
        simulation.dtMs
      ),
      dtMs: simulation.dtMs,
    }

    const fitness = weightedFitnessSum(
      metrics,
      fitnessWeights,
      gateConfig,
      context
    )

    results.push({
      index: i,
      id: scenario.id,
      difficulty: scenario.difficulty,
      wave: scenario.wave,
      rockCount: scenario.rocks.length,
      fitness,
      rocksDestroyed: metrics.rocksDestroyed,
      uniqueRocksSeen: metrics.uniqueRocksSeen,
      deaths: metrics.deaths,
      accuracy: metrics.accuracy,
      shotsFired: metrics.shotsFired,
      shotsHit: metrics.shotsHit,
      aliveFrames: metrics.aliveFrames,
    })
  }

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
  console.log(`Completed in ${elapsed}s\n`)

  // ── Aggregate statistics ──
  const fitnesses = results.map((r) => r.fitness)
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
  const stddev = (arr) => {
    const mean = avg(arr)
    return Math.sqrt(avg(arr.map((v) => (v - mean) ** 2)))
  }

  console.log('═'.repeat(72))
  console.log('Aggregate Statistics')
  console.log('═'.repeat(72))

  console.log(`\n── Fitness ──`)
  console.log(
    `  mean=${avg(fitnesses).toFixed(4)}  stddev=${stddev(fitnesses).toFixed(4)}  min=${Math.min(...fitnesses).toFixed(4)}  max=${Math.max(...fitnesses).toFixed(4)}`
  )

  // Fitness by difficulty bucket
  const diffBuckets = [
    { label: '0.00-0.10', min: 0.0, max: 0.1 },
    { label: '0.10-0.20', min: 0.1, max: 0.2 },
    { label: '0.20-0.30', min: 0.2, max: 0.3 },
    { label: '0.30-0.50', min: 0.3, max: 0.5 },
    { label: '0.50-1.00', min: 0.5, max: 1.0 },
  ]

  console.log(`\n── Fitness by Difficulty ──`)
  for (const bucket of diffBuckets) {
    const inBucket = results.filter(
      (r) => r.difficulty >= bucket.min && r.difficulty < bucket.max
    )
    if (inBucket.length === 0) continue
    const bucketFit = inBucket.map((r) => r.fitness)
    console.log(
      `  ${bucket.label}: n=${String(inBucket.length).padStart(4)}  avgFitness=${avg(bucketFit).toFixed(4)}  avgRocksDestroyed=${avg(inBucket.map((r) => r.rocksDestroyed)).toFixed(1)}  avgDeaths=${avg(inBucket.map((r) => r.deaths)).toFixed(2)}`
    )
  }

  // Fitness by wave
  console.log(`\n── Fitness by Wave ──`)
  const waveGroups = {}
  for (const r of results) {
    if (!waveGroups[r.wave]) waveGroups[r.wave] = []
    waveGroups[r.wave].push(r)
  }
  for (const [wave, group] of Object.entries(waveGroups).sort(
    (a, b) => Number(a[0]) - Number(b[0])
  )) {
    const waveFit = group.map((r) => r.fitness)
    console.log(
      `  wave ${wave}: n=${String(group.length).padStart(4)}  avgFitness=${avg(waveFit).toFixed(4)}  avgRocksDestroyed=${avg(group.map((r) => r.rocksDestroyed)).toFixed(1)}  avgDeaths=${avg(group.map((r) => r.deaths)).toFixed(2)}`
    )
  }

  // Survival stats
  const totalDeaths = results.reduce((s, r) => s + r.deaths, 0)
  const zeroDeath = results.filter((r) => r.deaths === 0).length
  const zeroRocks = results.filter((r) => r.rocksDestroyed === 0).length
  const perfectSurvival = results.filter(
    (r) => r.deaths === 0 && r.rocksDestroyed > 0
  ).length

  console.log(`\n── Survival & Engagement ──`)
  console.log(
    `  Total deaths: ${totalDeaths} across ${results.length} scenarios`
  )
  console.log(
    `  Zero-death scenarios: ${zeroDeath}/${results.length} (${((zeroDeath / results.length) * 100).toFixed(1)}%)`
  )
  console.log(
    `  Zero-rocks scenarios: ${zeroRocks}/${results.length} (${((zeroRocks / results.length) * 100).toFixed(1)}%)`
  )
  console.log(
    `  Perfect (survived + destroyed): ${perfectSurvival}/${results.length} (${((perfectSurvival / results.length) * 100).toFixed(1)}%)`
  )
  console.log(
    `  Avg accuracy: ${avg(results.map((r) => r.accuracy)).toFixed(4)}`
  )

  // Identify problematic scenarios
  const trivial = results.filter((r) => r.fitness > 0.9)
  const impossible = results.filter((r) => r.fitness < 0.01)

  console.log(`\n── Quality Flags ──`)
  console.log(`  Trivial (fitness > 0.9): ${trivial.length}/${results.length}`)
  if (trivial.length > 0 && trivial.length <= 10) {
    for (const r of trivial) {
      console.log(
        `    ${r.id}: diff=${r.difficulty.toFixed(3)} wave=${r.wave} fitness=${r.fitness.toFixed(4)}`
      )
    }
  }
  console.log(
    `  Too hard (fitness < 0.01): ${impossible.length}/${results.length}`
  )
  if (impossible.length > 0 && impossible.length <= 10) {
    for (const r of impossible) {
      console.log(
        `    ${r.id}: diff=${r.difficulty.toFixed(3)} wave=${r.wave} fitness=${r.fitness.toFixed(4)}`
      )
    }
  }

  // Distribution histogram
  console.log(`\n── Fitness Distribution ──`)
  const bins = 10
  const counts = new Array(bins).fill(0)
  for (const f of fitnesses) {
    const bin = Math.min(Math.floor(f * bins), bins - 1)
    counts[bin]++
  }
  const maxCount = Math.max(...counts)
  for (let i = 0; i < bins; i++) {
    const lo = (i / bins).toFixed(1)
    const hi = ((i + 1) / bins).toFixed(1)
    const bar = '█'.repeat(Math.round((counts[i] / maxCount) * 40))
    console.log(`  ${lo}-${hi}: ${bar} ${counts[i]}`)
  }

  console.log(`\n=== Done ===\n`)
}

main().catch((error) => {
  console.error('analyze-scenarios failed:', error)
  process.exit(1)
})
