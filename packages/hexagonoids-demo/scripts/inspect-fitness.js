/**
 * Diagnostic script: inspect scenario fitness scoring breakdown.
 *
 * Runs scenario evaluation with different agents (doNothing, random) and
 * shows the per-scenario weighted-sum fitness breakdown.
 *
 * Usage:
 *   node packages/hexagonoids-demo/scripts/inspect-fitness.js [--scenariosPerOrganism <n>] [--scenarioMaxTicks <n>] [--seed <seed>]
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')

function parseArgs(argv) {
  const options = {
    scenariosPerOrganism: 100,
    scenarioMaxTicks: 60,
    seed: 'inspect-fitness-001',
    dtMs: 33,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--scenariosPerOrganism' && argv[i + 1])
      options.scenariosPerOrganism = Number(argv[++i])
    else if (arg === '--scenarioMaxTicks' && argv[i + 1])
      options.scenarioMaxTicks = Number(argv[++i])
    else if (arg === '--seed' && argv[i + 1]) options.seed = argv[++i]
    else if (arg === '--dtMs' && argv[i + 1]) options.dtMs = Number(argv[++i])
  }
  return options
}

function pct(value) {
  return (value * 100).toFixed(1) + '%'
}
function pad(str, len) {
  return String(str).padEnd(len)
}
function fmtNum(n, decimals = 4) {
  return n.toFixed(decimals)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  const env = await import('@heygrady/hexagonoids-environment')
  const {
    doNothingAgent,
    randomAgent,
    simulateScenario,
    scenarioMaximums,
    scenarioPossibleDeaths,
    weightedFitnessSum,
    actionDiversityGate,
    DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
    mergeConfig,
  } = env

  const { createRNG } = await import('@neat-evolution/utils')

  const scenariosPath = resolve(packageRoot, 'src/data/scenarios.json')
  const scenarioBank = JSON.parse(readFileSync(scenariosPath, 'utf-8'))

  const config = mergeConfig({
    simulation: {
      scenariosPerOrganism: options.scenariosPerOrganism,
      scenarioMaxTicks: options.scenarioMaxTicks,
    },
  })

  const { scenariosPerOrganism, scenarioMaxTicks } = config.simulation
  const weights = config.fitnessWeights
  const gc = config.gateConfig

  console.log(`\n=== Scenario Fitness Inspection ===`)
  console.log(
    `scenariosPerOrganism=${scenariosPerOrganism} scenarioMaxTicks=${scenarioMaxTicks} seed="${options.seed}"`
  )
  console.log(`Bank size: ${scenarioBank.length}`)
  console.log(
    `Weights: rocks=${weights.rocksDestroyed} accuracy=${weights.accuracy} survival=${weights.survival}`
  )
  console.log()

  // Select scenarios
  const selectionRng = createRNG(options.seed)
  const selected = []
  const count = Math.min(scenariosPerOrganism, scenarioBank.length)
  if (count >= scenarioBank.length) {
    selected.push(...scenarioBank)
  } else {
    const indices = Array.from({ length: scenarioBank.length }, (_, i) => i)
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(selectionRng.gen() * (scenarioBank.length - i))
      const temp = indices[i]
      indices[i] = indices[j]
      indices[j] = temp
      selected.push(scenarioBank[indices[i]])
    }
  }

  // Lives distribution
  const livesDistrib = {}
  for (const sc of selected) {
    const l = sc.player.lives ?? 3
    livesDistrib[l] = (livesDistrib[l] || 0) + 1
  }
  console.log(`  Starting lives distribution:`)
  for (const [lives, cnt] of Object.entries(livesDistrib).sort(
    (a, b) => Number(a[0]) - Number(b[0])
  )) {
    console.log(`    lives=${lives}: ${cnt} scenarios`)
  }
  console.log()

  const agents = [
    { name: 'doNothing', agent: doNothingAgent, executor: undefined },
    { name: 'random', agent: randomAgent, executor: undefined },
  ]

  const agentData = []

  for (const { name, agent, executor } of agents) {
    console.log(`${'─'.repeat(60)}`)
    console.log(`Agent: ${name}`)
    console.log(`${'─'.repeat(60)}`)

    const scenarioConfig = { ...config.simulation, maxTicks: scenarioMaxTicks }
    const perScenario = []

    for (const scenario of selected) {
      const metrics = simulateScenario(
        agent,
        scenario,
        scenarioConfig,
        options.seed,
        executor
      )
      const { maxRocksDestroyed } = scenarioMaximums(scenario.rocks)
      const possibleDeaths = scenarioPossibleDeaths(
        scenario.player.lives,
        scenarioMaxTicks,
        options.dtMs
      )
      const context = { maxRocksDestroyed, possibleDeaths }
      const fitness = weightedFitnessSum(metrics, weights, gc, context)
      const actionGate = actionDiversityGate(metrics, gc)

      // Component breakdown
      const rocksNorm =
        maxRocksDestroyed > 0 ? metrics.rocksDestroyed / maxRocksDestroyed : 1
      const survivalTerm =
        possibleDeaths > 0
          ? Math.max(1 - metrics.deaths / possibleDeaths, 0)
          : 1

      perScenario.push({
        fitness,
        rocksNorm,
        accuracy: metrics.accuracy,
        survivalTerm,
        actionGate,
        rocksDestroyed: metrics.rocksDestroyed,
        maxRocksDestroyed,
        deaths: metrics.deaths,
        possibleDeaths,
        shotsFired: metrics.shotsFired,
        shotsHit: metrics.shotsHit,
      })
    }

    // Aggregate stats
    const n = perScenario.length
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / n

    const meanFitness = avg(perScenario.map((s) => s.fitness))
    const meanRocksNorm = avg(perScenario.map((s) => s.rocksNorm))
    const meanAccuracy = avg(perScenario.map((s) => s.accuracy))
    const meanSurvival = avg(perScenario.map((s) => s.survivalTerm))
    const meanActionGate = avg(perScenario.map((s) => s.actionGate))
    const totalRocks = perScenario.reduce((s, p) => s + p.rocksDestroyed, 0)
    const totalDeaths = perScenario.reduce((s, p) => s + p.deaths, 0)
    const totalShots = perScenario.reduce((s, p) => s + p.shotsFired, 0)
    const totalHits = perScenario.reduce((s, p) => s + p.shotsHit, 0)

    console.log(`\n── Per-Scenario Averages (${n} scenarios) ──`)
    console.log(`  meanFitness:    ${fmtNum(meanFitness)}`)
    console.log(
      `  Components:     rocks=${fmtNum(meanRocksNorm)}  acc=${fmtNum(meanAccuracy)}  surv=${fmtNum(meanSurvival)}`
    )
    console.log(
      `  Weighted perf:  ${fmtNum(weights.rocksDestroyed)}×${fmtNum(meanRocksNorm)} + ${fmtNum(weights.accuracy)}×${fmtNum(meanAccuracy)} + ${fmtNum(weights.survival)}×${fmtNum(meanSurvival)} = ${fmtNum(weights.rocksDestroyed * meanRocksNorm + weights.accuracy * meanAccuracy + weights.survival * meanSurvival)}`
    )
    console.log(`  actionGate:     ${fmtNum(meanActionGate)}`)
    console.log(`\n── Totals ──`)
    console.log(
      `  rocksDestroyed: ${totalRocks}  deaths: ${totalDeaths}  shots: ${totalShots}  hits: ${totalHits}  accuracy: ${totalShots > 0 ? pct(totalHits / totalShots) : 'n/a'}`
    )

    agentData.push({
      name,
      perScenario,
      meanFitness,
      meanRocksNorm,
      meanAccuracy,
      meanSurvival,
      meanActionGate,
    })
    console.log()
  }

  // Comparison
  if (agentData.length >= 2) {
    const dn = agentData.find((r) => r.name === 'doNothing')
    const rn = agentData.find((r) => r.name === 'random')

    if (dn && rn) {
      console.log(`${'═'.repeat(72)}`)
      console.log(`  COMPARISON: doNothing → random`)
      console.log(`${'═'.repeat(72)}`)
      console.log()
      console.log(
        `  ${pad('Component', 20)} ${pad('doNothing', 10)} ${pad('random', 10)} ${pad('gap', 10)} signal`
      )
      console.log(`  ${'─'.repeat(56)}`)

      const rows = [
        ['fitness', dn.meanFitness, rn.meanFitness],
        ['rocksNorm', dn.meanRocksNorm, rn.meanRocksNorm],
        ['accuracy', dn.meanAccuracy, rn.meanAccuracy],
        ['survivalTerm', dn.meanSurvival, rn.meanSurvival],
        ['actionGate', dn.meanActionGate, rn.meanActionGate],
      ]

      for (const [label, dv, rv] of rows) {
        const gap = rv - dv
        const signal =
          gap < 0.02
            ? '  no gap'
            : gap < 0.1
              ? '  marginal'
              : gap < 0.25
                ? '  good'
                : '  strong'
        console.log(
          `  ${pad(label, 20)} ${pad(fmtNum(dv), 10)} ${pad(fmtNum(rv), 10)} ${pad((gap >= 0 ? '+' : '') + fmtNum(gap), 10)} ${signal}`
        )
      }

      console.log(`\n  What a skilled NEAT agent needs to beat random:`)
      console.log(
        `    - Higher accuracy: random=${pct(rn.meanAccuracy)}, skilled target=30-50%`
      )
      console.log(
        `    - More rocks: random avg rocksNorm=${fmtNum(rn.meanRocksNorm)}, need aim + seek`
      )
      console.log(
        `    - Fewer deaths: random avg survival=${fmtNum(rn.meanSurvival)}`
      )
    }
  }

  console.log(`\n${'═'.repeat(72)}`)
  console.log(`=== Done ===\n`)
}

main().catch((error) => {
  console.error('inspect-fitness failed:', error)
  process.exit(1)
})
