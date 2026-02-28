/**
 * Generate scenario snapshots for scenario-based training.
 *
 * Plays games with randomAgent, captures state before each player death,
 * and writes the resulting scenario bank to a JSON file.
 *
 * Usage:
 *   node packages/hexagonoids-demo/scripts/generate-scenarios.js [--count <n>] [--seed <seed>] [--rewind <frames>] [--max-games <n>] [--output <path>]
 */
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')

function parseArgs(argv) {
  const options = {
    count: 100,
    seed: 'scenario-gen',
    rewind: 60,
    maxGames: 500,
    output: resolve(packageRoot, 'src/data/scenarios.json'),
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--count' && argv[i + 1]) options.count = Number(argv[++i])
    else if (arg === '--seed' && argv[i + 1]) options.seed = argv[++i]
    else if (arg === '--rewind' && argv[i + 1])
      options.rewind = Number(argv[++i])
    else if (arg === '--max-games' && argv[i + 1])
      options.maxGames = Number(argv[++i])
    else if (arg === '--output' && argv[i + 1]) options.output = argv[++i]
  }
  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  console.log(
    `\n=== Scenario Generation: count=${options.count} seed="${options.seed}" rewind=${options.rewind} maxGames=${options.maxGames} ===\n`
  )

  // Import from environment package (built dist)
  const { generateScenarios } = await import(
    '@heygrady/hexagonoids-environment/node'
  )

  const startTime = performance.now()
  const scenarios = generateScenarios({
    count: options.count,
    baseSeed: options.seed,
    rewindFrames: options.rewind,
    maxGames: options.maxGames,
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
