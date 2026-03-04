/**
 * Diagnostic script: inspect fitness scoring breakdown.
 *
 * Runs evaluation with different agents (doNothing, random) and shows
 * per-component fitness breakdown including curriculum scoring.
 *
 * Usage:
 *   node packages/hexagonoids-demo/scripts/inspect-fitness.js [--scenariosPerOrganism <n>] [--scenarioMaxTicks <n>] [--seed <seed>] [--curriculum]
 *   node packages/hexagonoids-demo/scripts/inspect-fitness.js --genome <path> [--method <method>]
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')

function parseArgs(argv, envDefaults) {
  const options = {
    scenariosPerOrganism: 100,
    scenarioMaxTicks: 60,
    seed: 'inspect-fitness-001',
    dtMs: envDefaults.simulation.dtMs,
    curriculum: false,
    curriculumCount: envDefaults.simulation.curriculumCount,
    scenarioWeight: envDefaults.scenarioWeight,
    fullGameWeight: envDefaults.fullGameWeight,
    curriculumWeight: envDefaults.curriculumWeight,
    genome: undefined,
    method: 'HyperNEAT',
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--scenariosPerOrganism' && argv[i + 1])
      options.scenariosPerOrganism = Number(argv[++i])
    else if (arg === '--scenarioMaxTicks' && argv[i + 1])
      options.scenarioMaxTicks = Number(argv[++i])
    else if (arg === '--seed' && argv[i + 1]) options.seed = argv[++i]
    else if (arg === '--dtMs' && argv[i + 1]) options.dtMs = Number(argv[++i])
    else if (arg === '--curriculum') options.curriculum = true
    else if (arg === '--curriculumCount' && argv[i + 1])
      options.curriculumCount = Number(argv[++i])
    else if (arg === '--scenarioWeight' && argv[i + 1])
      options.scenarioWeight = Number(argv[++i])
    else if (arg === '--fullGameWeight' && argv[i + 1])
      options.fullGameWeight = Number(argv[++i])
    else if (arg === '--curriculumWeight' && argv[i + 1])
      options.curriculumWeight = Number(argv[++i])
    else if (arg === '--genome' && argv[i + 1]) options.genome = argv[++i]
    else if (arg === '--method' && argv[i + 1]) options.method = argv[++i]
  }
  return options
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`
}
function pad(str, len) {
  return String(str).padEnd(len)
}
function fmtNum(n, decimals = 4) {
  return n.toFixed(decimals)
}

async function main() {
  const env = await import('@heygrady/hexagonoids-environment')
  const { DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG } = env
  const options = parseArgs(
    process.argv.slice(2),
    DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG
  )
  const {
    decodeScenarioBankDocument,
    doNothingAgent,
    randomAgent,
    simulateScenario,
    scenarioPossibleDeaths,
    weightedFitnessSum,
    actionDiversityGate,
    turnGate,
    runCurriculum,
    mergeConfig,
  } = env

  const { createRNG } = await import('@neat-evolution/utils')

  const scenariosPath = resolve(packageRoot, 'src/data/scenarios.json')
  const scenarioBank = decodeScenarioBankDocument(
    JSON.parse(readFileSync(scenariosPath, 'utf-8'))
  )

  const config = mergeConfig({
    simulation: {
      scenariosPerOrganism: options.scenariosPerOrganism,
      scenarioMaxTicks: options.scenarioMaxTicks,
    },
  })

  const { scenariosPerOrganism, scenarioMaxTicks } = config.simulation
  const weights = config.fitnessWeights
  const gc = config.gateConfig

  // Normalize blending weights
  let sw = options.scenarioWeight
  let fw = options.fullGameWeight
  let cw = options.curriculum ? options.curriculumWeight : 0
  const total = sw + fw + cw
  if (total > 0) {
    sw /= total
    fw /= total
    cw /= total
  }

  console.log(`\n=== Fitness Inspection ===`)
  console.log(
    `scenariosPerOrganism=${scenariosPerOrganism} scenarioMaxTicks=${scenarioMaxTicks} seed="${options.seed}"`
  )
  console.log(`Bank size: ${scenarioBank.length}`)
  console.log(
    `Weights: rocks=${weights.rocksDestroyed} accuracy=${weights.accuracy}`
  )
  if (options.curriculum) {
    console.log(`Curriculum: enabled, count=${options.curriculumCount}`)
  }
  console.log(
    `Blending: scenario=${fmtNum(sw, 2)} fullGame=${fmtNum(fw, 2)} curriculum=${fmtNum(cw, 2)}`
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

  // Load genome agent if --genome provided
  if (options.genome) {
    const genomePath = resolve(options.genome)
    console.log(`Loading genome: ${genomePath}`)
    console.log(`Method: ${options.method}`)

    const { createNeatAgent } = env
    const { loadGenome } = await import('../dist/esm/persistence/loadGenome.js')
    const {
      createGenomeFromSerialized,
      HEXAGONOIDS_IO,
      createPhenotypeForGenome,
    } = await import('../dist/esm/algorithmRegistry.js')
    const { createExecutor } = await import('@neat-evolution/executor')

    const serialized = loadGenome(genomePath)
    const genomeData = serialized.genome
    const genomeOptions = genomeData.genomeOptions
    const isRecord = (v) => v != null && typeof v === 'object'
    const initConfig = isRecord(genomeOptions?.initConfig)
      ? genomeOptions.initConfig
      : HEXAGONOIDS_IO

    const genome = createGenomeFromSerialized(
      options.method,
      genomeData,
      initConfig
    )
    const phenotype = createPhenotypeForGenome(options.method, genome)
    const executor = createExecutor(phenotype)
    const agent = createNeatAgent()

    const genLabel = genomePath.split('/').pop().replace('.json', '')
    agents.push({ name: genLabel, agent, executor })
    console.log()
  }

  const agentData = []

  for (const { name, agent, executor } of agents) {
    console.log(`${'─'.repeat(60)}`)
    console.log(`Agent: ${name}`)
    console.log(`${'─'.repeat(60)}`)

    // Curriculum scoring (using weightedFitnessSum per scenario)
    let curriculumFitness = 0
    let curriculumKills = 0
    let curriculumTotal = 0
    if (options.curriculum) {
      const metricsArray = runCurriculum(
        agent,
        options.seed,
        options.dtMs,
        options.curriculumCount,
        executor
      )
      curriculumTotal = metricsArray.length
      let currFitnessSum = 0
      for (const m of metricsArray) {
        if (m.rocksDestroyed > 0) curriculumKills++
        currFitnessSum += weightedFitnessSum(m, weights, gc, {
          possibleDeaths: 1,
        })
      }
      curriculumFitness =
        metricsArray.length > 0 ? currFitnessSum / metricsArray.length : 0
      console.log(
        `  Curriculum: ${curriculumKills}/${curriculumTotal} kills → avgFitness=${fmtNum(curriculumFitness)}`
      )
    }

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
      const possibleDeaths = scenarioPossibleDeaths(
        scenario.player.lives,
        scenarioMaxTicks,
        options.dtMs
      )

      // Compute effectiveMaxRocks the same way calculateFitness does
      const effectiveMaxRocks = Math.max(1, metrics.uniqueRocksSeen * 0.5)
      const rocksNorm = Math.min(metrics.rocksDestroyed / effectiveMaxRocks, 1)

      const survivalTerm =
        possibleDeaths > 0
          ? Math.max(1 - metrics.deaths / possibleDeaths, 0)
          : 1

      const actionGateVal = actionDiversityGate(metrics, gc)
      const turnGateVal = turnGate(metrics, gc)

      // Weighted perf score (before gates)
      const perfScore =
        weights.rocksDestroyed * rocksNorm + weights.accuracy * metrics.accuracy

      const context = { possibleDeaths }
      const fitness = weightedFitnessSum(metrics, weights, gc, context)

      perScenario.push({
        fitness,
        perfScore,
        rocksNorm,
        accuracy: metrics.accuracy,
        survivalTerm,
        actionGateVal,
        turnGateVal,
        rocksDestroyed: metrics.rocksDestroyed,
        uniqueRocksSeen: metrics.uniqueRocksSeen,
        effectiveMaxRocks,
        deaths: metrics.deaths,
        possibleDeaths,
        shotsFired: metrics.shotsFired,
        shotsHit: metrics.shotsHit,
        aliveFrames: metrics.aliveFrames,
      })
    }

    // Aggregate stats
    const n = perScenario.length
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / n
    const sum = (arr) => arr.reduce((a, b) => a + b, 0)

    const meanScenarioFitness = avg(perScenario.map((s) => s.fitness))
    const meanPerfScore = avg(perScenario.map((s) => s.perfScore))
    const meanRocksNorm = avg(perScenario.map((s) => s.rocksNorm))
    const meanAccuracy = avg(perScenario.map((s) => s.accuracy))
    const meanSurvival = avg(perScenario.map((s) => s.survivalTerm))
    const meanActionGate = avg(perScenario.map((s) => s.actionGateVal))
    const meanTurnGate = avg(perScenario.map((s) => s.turnGateVal))
    const meanEffectiveMax = avg(perScenario.map((s) => s.effectiveMaxRocks))
    const meanUniqueRocksSeen = avg(perScenario.map((s) => s.uniqueRocksSeen))
    const totalRocks = sum(perScenario.map((p) => p.rocksDestroyed))
    const totalDeaths = sum(perScenario.map((p) => p.deaths))
    const totalShots = sum(perScenario.map((p) => p.shotsFired))
    const totalHits = sum(perScenario.map((p) => p.shotsHit))

    // Blended fitness
    const blendedFitness = sw * meanScenarioFitness + cw * curriculumFitness
    // (fw * fullGameFitness would require running a full game — omitted here)

    console.log(`\n── Scenario Averages (${n} scenarios) ──`)
    console.log(`  scenarioFitness:  ${fmtNum(meanScenarioFitness)}`)
    if (options.curriculum) {
      console.log(`  curriculumFitness: ${fmtNum(curriculumFitness)}`)
    }
    console.log(
      `  blendedFitness:   ${fmtNum(blendedFitness)} (scenario×${fmtNum(sw, 2)} + curriculum×${fmtNum(cw, 2)}, fullGame omitted)`
    )
    console.log()

    console.log(`  ── Performance Components ──`)
    console.log(`  perfScore (weighted sum):   ${fmtNum(meanPerfScore)}`)
    console.log(
      `    rocksNorm:    ${fmtNum(meanRocksNorm)}  (w=${weights.rocksDestroyed} → ${fmtNum(weights.rocksDestroyed * meanRocksNorm)})`
    )
    console.log(
      `    accuracy:     ${fmtNum(meanAccuracy)}  (w=${weights.accuracy} → ${fmtNum(weights.accuracy * meanAccuracy)})`
    )
    console.log()

    console.log(`  ── Gates (multiplicative) ──`)
    console.log(`  actionGate:     ${fmtNum(meanActionGate)}`)
    console.log(`  turnGate:       ${fmtNum(meanTurnGate)}`)
    console.log(`  survivalGate:   ${fmtNum(meanSurvival)}`)
    console.log()

    console.log(`  ── Rock Denominator ──`)
    console.log(`  rockKillFactor: 0.5 (kill half of seen = max score)`)
    console.log(
      `  mean uniqueRocksSeen:        ${fmtNum(meanUniqueRocksSeen, 1)}`
    )
    console.log(`  mean effectiveMaxRocks:      ${fmtNum(meanEffectiveMax, 1)}`)
    console.log(`  mean rocksDestroyed:         ${fmtNum(totalRocks / n, 1)}`)
    console.log()

    console.log(`── Totals ──`)
    console.log(
      `  rocksDestroyed: ${totalRocks}  deaths: ${totalDeaths}  shots: ${totalShots}  hits: ${totalHits}  accuracy: ${totalShots > 0 ? pct(totalHits / totalShots) : 'n/a'}`
    )

    agentData.push({
      name,
      meanScenarioFitness,
      curriculumFitness,
      blendedFitness,
      meanPerfScore,
      meanRocksNorm,
      meanAccuracy,
      meanSurvival,
      meanActionGate,
      meanTurnGate,
      meanEffectiveMax,
      meanUniqueRocksSeen,
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
        `  ${pad('Component', 22)} ${pad('doNothing', 10)} ${pad('random', 10)} ${pad('gap', 10)} signal`
      )
      console.log(`  ${'─'.repeat(62)}`)

      const rows = [
        ['scenarioFitness', dn.meanScenarioFitness, rn.meanScenarioFitness],
        ...(options.curriculum
          ? [['curriculumFitness', dn.curriculumFitness, rn.curriculumFitness]]
          : []),
        ['blendedFitness', dn.blendedFitness, rn.blendedFitness],
        ['perfScore', dn.meanPerfScore, rn.meanPerfScore],
        ['rocksNorm', dn.meanRocksNorm, rn.meanRocksNorm],
        ['accuracy', dn.meanAccuracy, rn.meanAccuracy],
        ['survivalGate', dn.meanSurvival, rn.meanSurvival],
        ['actionGate', dn.meanActionGate, rn.meanActionGate],
        ['turnGate', dn.meanTurnGate, rn.meanTurnGate],
        ['effectiveMaxRocks', dn.meanEffectiveMax, rn.meanEffectiveMax],
        ['uniqueRocksSeen', dn.meanUniqueRocksSeen, rn.meanUniqueRocksSeen],
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
          `  ${pad(label, 22)} ${pad(fmtNum(dv), 10)} ${pad(fmtNum(rv), 10)} ${pad((gap >= 0 ? '+' : '') + fmtNum(gap), 10)} ${signal}`
        )
      }

      console.log()
    }
  }

  console.log(`${'═'.repeat(72)}`)
  console.log(`=== Done ===\n`)
}

main().catch((error) => {
  console.error('inspect-fitness failed:', error)
  process.exit(1)
})
