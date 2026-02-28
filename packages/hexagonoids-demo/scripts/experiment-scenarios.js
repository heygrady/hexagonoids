/**
 * A/B experiment: full-game vs scenario-based training.
 *
 * Runs both modes with the same population/iterations and prints
 * a side-by-side comparison of fitness results and elapsed time.
 *
 * Prerequisites:
 *   yarn turbo run build --filter='@heygrady/hexagonoids-demo...'
 *
 * Usage:
 *   node packages/hexagonoids-demo/scripts/experiment-scenarios.js [options]
 *
 * Options:
 *   --iterations <int>      Number of evolution iterations (default: 20)
 *   --population <int>      Population size (default: 64)
 *   --method <name>         Algorithm: NEAT | CPPN | ... (default: NEAT)
 *   --seeds-per <int>       Evaluation seeds per organism (default: 4)
 *   --output-dir <path>     Output directory for genomes/logs
 *   --thread-count <int>    Worker threads (default: auto)
 */

function parseArgs(argv) {
  const options = {
    iterations: 20,
    population: 64,
    method: 'NEAT',
    seedsPer: 4,
    outputDir: undefined,
    threadCount: undefined,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--iterations' && argv[i + 1])
      options.iterations = Number(argv[++i])
    else if (arg === '--population' && argv[i + 1])
      options.population = Number(argv[++i])
    else if (arg === '--method' && argv[i + 1]) options.method = argv[++i]
    else if (arg === '--seeds-per' && argv[i + 1])
      options.seedsPer = Number(argv[++i])
    else if (arg === '--output-dir' && argv[i + 1])
      options.outputDir = argv[++i]
    else if (arg === '--thread-count' && argv[i + 1])
      options.threadCount = Number(argv[++i])
  }
  return options
}

function formatNum(value) {
  if (value == null) return 'N/A'
  return value.toFixed(4)
}

function formatTime(ms) {
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds - minutes * 60
  return `${minutes}m ${remaining.toFixed(1)}s`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  console.log('\n=== Scenario A/B Experiment ===')
  console.log(`  iterations:  ${options.iterations}`)
  console.log(`  population:  ${options.population}`)
  console.log(`  method:      ${options.method}`)
  console.log(`  seeds/org:   ${options.seedsPer}`)
  console.log()

  const { train } = await import('@heygrady/hexagonoids-demo/node')

  const baseOptions = {
    method: options.method,
    populationSize: options.population,
    iterations: options.iterations,
    evaluationSeedsPerOrganism: options.seedsPer,
    outputDir: options.outputDir,
    ...(options.threadCount != null && { threadCount: options.threadCount }),
  }

  // ── Control: full-game training ─────────────────────────────────────
  console.log('── Running CONTROL (full-game training) ──')
  const controlStart = Date.now()
  const controlResult = await train({
    ...baseOptions,
    baseSeed: 'ab-control',
  })
  const controlElapsed = Date.now() - controlStart

  // ── Treatment: scenario training ────────────────────────────────────
  console.log('\n── Running TREATMENT (scenario training) ──')
  const scenarioStart = Date.now()
  const scenarioResult = await train({
    ...baseOptions,
    baseSeed: 'ab-scenario',
    scenarioMode: true,
  })
  const scenarioElapsed = Date.now() - scenarioStart

  // ── Comparison ──────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('                  A/B COMPARISON')
  console.log('═══════════════════════════════════════════════════════')

  const label = (text) => text.padEnd(22)
  const col = (text) => String(text).padStart(14)

  console.log(label('') + col('Full-Game') + col('Scenario'))
  console.log('─'.repeat(50))

  if (controlResult.mode === 'training' && scenarioResult.mode === 'training') {
    console.log(
      label('Best Fitness') +
        col(formatNum(controlResult.bestFitness)) +
        col(formatNum(scenarioResult.bestFitness))
    )
    console.log(
      label('Population Mean') +
        col(formatNum(controlResult.populationFitnessMean)) +
        col(formatNum(scenarioResult.populationFitnessMean))
    )
    console.log(
      label('Population Median') +
        col(formatNum(controlResult.populationFitnessMedian)) +
        col(formatNum(scenarioResult.populationFitnessMedian))
    )
  }

  console.log(
    label('Elapsed Time') +
      col(formatTime(controlElapsed)) +
      col(formatTime(scenarioElapsed))
  )

  const speedup =
    controlElapsed > 0 ? (controlElapsed / scenarioElapsed).toFixed(2) : 'N/A'
  console.log(label('Speed Ratio') + col('1.00x') + col(`${speedup}x`))

  console.log('─'.repeat(50))

  if (controlResult.mode === 'training') {
    console.log(`\nControl genome:  ${controlResult.bestFilePath}`)
  }
  if (scenarioResult.mode === 'training') {
    console.log(`Scenario genome: ${scenarioResult.bestFilePath}`)
  }

  console.log('\n=== Done ===\n')
}

main().catch((error) => {
  console.error('experiment-scenarios failed:', error)
  process.exit(1)
})
