/**
 * Diagnostic script: inspect fitness scoring breakdown.
 *
 * Runs evaluation with different agents (doNothing, random) and shows
 * per-component fitness breakdown including curriculum and full game scoring.
 *
 * Usage:
 *   node packages/hexagonoids-demo/scripts/inspect-fitness.js [--scenariosPerOrganism <n>] [--scenarioMaxTicks <n>] [--seed <seed>] [--curriculum]
 *   node packages/hexagonoids-demo/scripts/inspect-fitness.js --genome <path> [--method <method>] [--maxTicks <n>] [--fullGameSeeds <n>]
 *   node packages/hexagonoids-demo/scripts/inspect-fitness.js --lab <path>   (use specific lab directory)
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
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

function parseArgs(argv, profileConfig, envDefaults) {
  const pc = profileConfig ?? {}
  const options = {
    scenariosPerOrganism: pc.scenariosPerOrganism ?? 100,
    scenarioMaxTicks: pc.scenarioMaxTicks ?? 60,
    seed: 'inspect-fitness-001',
    dtMs: pc.dtMs ?? envDefaults.simulation.dtMs,
    curriculum: pc.curriculumEnabled ?? false,
    curriculumCount:
      pc.curriculumCount ?? envDefaults.simulation.curriculumCount,
    scenarioWeight: pc.scenarioWeight ?? envDefaults.scenarioWeight,
    fullGameWeight: pc.fullGameWeight ?? envDefaults.fullGameWeight,
    curriculumWeight: pc.curriculumWeight ?? envDefaults.curriculumWeight,
    maxTicks: pc.maxTicks ?? envDefaults.simulation.maxTicks,
    fullGameSeeds: pc.fullGameSeedsPerOrganism ?? 4,
    genome: undefined,
    lab: undefined,
    method: pc.method ?? 'HyperNEAT',
    actionGateFloor: undefined,
    turnGateFloor: undefined,
    turnBiasGateFloor: undefined,
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
    else if (arg === '--maxTicks' && argv[i + 1])
      options.maxTicks = Number(argv[++i])
    else if (arg === '--fullGameSeeds' && argv[i + 1])
      options.fullGameSeeds = Number(argv[++i])
    else if (arg === '--genome' && argv[i + 1]) options.genome = argv[++i]
    else if (arg === '--lab' && argv[i + 1]) options.lab = argv[++i]
    else if (arg === '--method' && argv[i + 1]) options.method = argv[++i]
    else if (arg === '--actionGateFloor' && argv[i + 1])
      options.actionGateFloor = Number(argv[++i])
    else if (arg === '--turnGateFloor' && argv[i + 1])
      options.turnGateFloor = Number(argv[++i])
    else if (arg === '--turnBiasGateFloor' && argv[i + 1])
      options.turnBiasGateFloor = Number(argv[++i])
  }
  return options
}

function findMostRecentLab() {
  const labRoot = resolve(packageRoot, '.artifacts/lab')
  if (!existsSync(labRoot)) return null
  const entries = readdirSync(labRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
  // Prefer the most recent completed lab (has a best-*.json file)
  for (let i = entries.length - 1; i >= 0; i--) {
    const dir = join(labRoot, entries[i])
    const hasBest = readdirSync(dir).some((f) => /^best-.+\.json$/.test(f))
    if (hasBest) return dir
  }
  return null
}

function discoverLabGenomes(labDir) {
  const results = []

  // Read config to get method
  const configPath = join(labDir, 'config.json')
  let method = 'HyperNEAT'
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    method = config.trainOptions?.method ?? config.method ?? 'HyperNEAT'
  }

  // Find best genome
  const bestFile = `best-${method}.json`
  const bestPath = join(labDir, bestFile)
  if (existsSync(bestPath)) {
    results.push({ label: 'best', genomePath: bestPath, method })
  }

  // Sample generation genomes
  const genomesDir = join(labDir, 'genomes')
  if (existsSync(genomesDir)) {
    const genFiles = readdirSync(genomesDir)
      .filter((f) => /^gen-\d+\.json$/.test(f))
      .sort()
    if (genFiles.length > 0) {
      // Pick ~5 evenly spaced: first, ~25%, ~50%, ~75%, last
      const indices = new Set()
      const count = Math.min(5, genFiles.length)
      for (let i = 0; i < count; i++) {
        const idx = Math.round((i * (genFiles.length - 1)) / (count - 1))
        indices.add(idx)
      }
      for (const idx of [...indices].sort((a, b) => a - b)) {
        const file = genFiles[idx]
        const genNum = file.replace('gen-', '').replace('.json', '')
        results.push({
          label: `gen-${genNum}`,
          genomePath: join(genomesDir, file),
          method,
        })
      }
    }
  }

  return results
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

  // Load default profile for base config
  const { defaultProfile } = await import(
    '../dist/esm/features/profiles/index.js'
  )
  const profileConfig = defaultProfile.config ?? {}

  const options = parseArgs(
    process.argv.slice(2),
    profileConfig,
    DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG
  )

  const {
    decodeScenarioBankDocument,
    doNothingAgent,
    randomAgent,
    simulateScenario,
    simulateGame,
    computePossibleDeaths,
    computePossibleKills,
    weightedFitnessSum,
    actionDiversityGate,
    turnGate,
    turnBiasGate,
    applyBehavioralGates,
    runCurriculum,
    mergeConfig,
  } = env

  const { createRNG } = await import('@neat-evolution/utils')

  // Build environment config from profile
  const config = mergeConfig({
    simulation: {
      scenariosPerOrganism: options.scenariosPerOrganism,
      scenarioMaxTicks: options.scenarioMaxTicks,
      maxTicks: options.maxTicks,
      dtMs: options.dtMs,
    },
    fitnessWeights: profileConfig.fitnessWeights,
    gateConfig: {
      ...profileConfig.gateConfig,
      ...(options.actionGateFloor !== undefined && {
        actionGateFloor: options.actionGateFloor,
      }),
      ...(options.turnGateFloor !== undefined && {
        turnGateFloor: options.turnGateFloor,
      }),
      ...(options.turnBiasGateFloor !== undefined && {
        turnBiasGateFloor: options.turnBiasGateFloor,
      }),
    },
  })

  const scenariosPath = resolve(packageRoot, 'src/data/scenarioBank.js')
  const scenarioBank = decodeScenarioBankDocument(
    readScenarioBank(scenariosPath)
  )

  const { scenariosPerOrganism, scenarioMaxTicks } = config.simulation
  const weights = config.fitnessWeights
  const gc = config.gateConfig

  // Full game possibleDeaths (reference value for display, actual computed per-seed)
  const fgPossibleDeaths = computePossibleDeaths(options.maxTicks, options.dtMs)

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
    `Weights: rocks=${weights.rocksDestroyed} accuracy=${weights.accuracy} targetAccuracy=${weights.targetAccuracy}`
  )
  if (options.curriculum) {
    console.log(`Curriculum: enabled, count=${options.curriculumCount}`)
  }
  console.log(
    `Blending: scenario=${fmtNum(sw, 2)} fullGame=${fmtNum(fw, 2)} curriculum=${fmtNum(cw, 2)}`
  )
  console.log(
    `Full game: maxTicks=${options.maxTicks} seeds=${options.fullGameSeeds} maxPossibleDeaths=${fgPossibleDeaths} (per-seed from elapsedTicks)`
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

  // Lazy-loaded genome dependencies
  let _genomeDeps = null
  async function getGenomeDeps() {
    if (!_genomeDeps) {
      const { createNeatAgent } = env
      const { loadGenome } = await import(
        '../dist/esm/persistence/loadGenome.js'
      )
      const {
        createGenomeFromSerialized,
        HEXAGONOIDS_IO,
        createPhenotypeForGenome,
      } = await import('../dist/esm/algorithmRegistry.js')
      const { createExecutor } = await import('@neat-evolution/executor')
      _genomeDeps = {
        createNeatAgent,
        loadGenome,
        createGenomeFromSerialized,
        HEXAGONOIDS_IO,
        createPhenotypeForGenome,
        createExecutor,
      }
    }
    return _genomeDeps
  }

  async function loadGenomeAgent(genomePath, method, label) {
    const {
      createNeatAgent,
      loadGenome,
      createGenomeFromSerialized,
      HEXAGONOIDS_IO,
      createPhenotypeForGenome,
      createExecutor,
    } = await getGenomeDeps()

    const serialized = loadGenome(genomePath)
    const genomeData = serialized.genome
    const genomeOptions = genomeData.genomeOptions
    const isRecord = (v) => v != null && typeof v === 'object'
    const initConfig = isRecord(genomeOptions?.initConfig)
      ? genomeOptions.initConfig
      : HEXAGONOIDS_IO

    const genome = createGenomeFromSerialized(method, genomeData, initConfig)
    const phenotype = createPhenotypeForGenome(method, genome)
    const executor = createExecutor(phenotype)
    const agent = createNeatAgent()

    return { name: label, agent, executor }
  }

  // Auto-discover lab genomes when no explicit --genome given
  if (!options.genome) {
    const labDir = options.lab ? resolve(options.lab) : findMostRecentLab()
    if (labDir) {
      const labGenomes = discoverLabGenomes(labDir)
      if (labGenomes.length > 0) {
        const hasBest = labGenomes.some((g) => g.label === 'best')
        const sampledCount = labGenomes.filter((g) => g.label !== 'best').length
        const parts = []
        if (hasBest) parts.push('best')
        if (sampledCount > 0) parts.push(`${sampledCount} sampled generations`)
        console.log(`Lab: ${labDir}`)
        console.log(`Found ${labGenomes.length} genomes (${parts.join(' + ')})`)
        for (const g of labGenomes) {
          agents.push(await loadGenomeAgent(g.genomePath, g.method, g.label))
        }
        console.log()
      }
    }
  }

  // Load genome agent if --genome provided
  if (options.genome) {
    const genomePath = resolve(options.genome)
    console.log(`Loading genome: ${genomePath}`)
    console.log(`Method: ${options.method}`)
    const genLabel = genomePath.split('/').pop().replace('.json', '')
    agents.push(await loadGenomeAgent(genomePath, options.method, genLabel))
    console.log()
  }

  const agentData = []

  for (const { name, agent, executor } of agents) {
    console.log(`${'─'.repeat(60)}`)
    console.log(`Agent: ${name}`)
    console.log(`${'─'.repeat(60)}`)

    // ── Frame accumulator for aggregated behavioral gates ──
    const aggFrames = {
      thrustFrames: 0,
      fireFrames: 0,
      leftFrames: 0,
      rightFrames: 0,
      aliveFrames: 0,
    }

    // ── Curriculum scoring ──
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
        aggFrames.thrustFrames += m.thrustFrames
        aggFrames.fireFrames += m.fireFrames
        aggFrames.leftFrames += m.leftFrames
        aggFrames.rightFrames += m.rightFrames
        aggFrames.aliveFrames += m.aliveFrames
        if (m.rocksDestroyed > 0) curriculumKills++
        currFitnessSum += weightedFitnessSum(m, weights, gc, {
          possibleDeaths: computePossibleDeaths(m.elapsedTicks, options.dtMs),
          dtMs: options.dtMs,
        })
      }
      curriculumFitness =
        metricsArray.length > 0 ? currFitnessSum / metricsArray.length : 0
    }

    // ── Scenario scoring ──
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
      aggFrames.thrustFrames += metrics.thrustFrames
      aggFrames.fireFrames += metrics.fireFrames
      aggFrames.leftFrames += metrics.leftFrames
      aggFrames.rightFrames += metrics.rightFrames
      aggFrames.aliveFrames += metrics.aliveFrames
      const possibleDeaths = computePossibleDeaths(
        metrics.elapsedTicks,
        options.dtMs
      )

      const targetAccuracy =
        weights.targetAccuracy > 0 ? weights.targetAccuracy : 0.2
      const effectiveMaxRocks = computePossibleKills(
        metrics.elapsedTicks,
        options.dtMs,
        metrics.uniqueRocksSeen
      )
      const rocksNorm = Math.min(metrics.rocksDestroyed / effectiveMaxRocks, 1)

      const survivalRaw =
        possibleDeaths > 0
          ? Math.max(1 - metrics.deaths / possibleDeaths, 0)
          : 1
      const survivalTerm = Math.max(survivalRaw, gc.survivalGateFloor)

      const actionGateVal = actionDiversityGate(metrics, gc)
      const turnGateVal = turnGate(metrics, gc)
      const turnBiasVal = turnBiasGate(metrics, gc)

      const accuracyNorm = Math.min(metrics.accuracy / targetAccuracy, 1)

      const perfScore =
        weights.rocksDestroyed * rocksNorm + weights.accuracy * accuracyNorm

      const context = { possibleDeaths, dtMs: options.dtMs }
      const fitness = weightedFitnessSum(metrics, weights, gc, context)

      perScenario.push({
        fitness,
        perfScore,
        rocksNorm,
        accuracy: metrics.accuracy,
        accuracyNorm,
        survivalTerm,
        actionGateVal,
        turnGateVal,
        turnBiasVal,
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

    // ── Full Game scoring ──
    const fullGameSimConfig = {
      ...config.simulation,
      maxTicks: options.maxTicks,
      useFastThrust: true,
    }
    const perFullGame = []

    for (let i = 0; i < options.fullGameSeeds; i++) {
      const seed = `${options.seed}:fullgame:${i}`
      const metrics = simulateGame(agent, fullGameSimConfig, seed, executor)
      aggFrames.thrustFrames += metrics.thrustFrames
      aggFrames.fireFrames += metrics.fireFrames
      aggFrames.leftFrames += metrics.leftFrames
      aggFrames.rightFrames += metrics.rightFrames
      aggFrames.aliveFrames += metrics.aliveFrames

      const targetAccuracy =
        weights.targetAccuracy > 0 ? weights.targetAccuracy : 0.2
      const effectiveMaxRocks = computePossibleKills(
        metrics.elapsedTicks,
        options.dtMs,
        metrics.uniqueRocksSeen
      )
      const rocksNorm = Math.min(metrics.rocksDestroyed / effectiveMaxRocks, 1)

      const fgSeedPossibleDeaths = computePossibleDeaths(
        metrics.elapsedTicks,
        options.dtMs
      )
      const survivalRaw =
        fgSeedPossibleDeaths > 0
          ? Math.max(1 - metrics.deaths / fgSeedPossibleDeaths, 0)
          : 1
      const survivalTerm = Math.max(survivalRaw, gc.survivalGateFloor)

      const actionGateVal = actionDiversityGate(metrics, gc)
      const turnGateVal = turnGate(metrics, gc)
      const turnBiasVal = turnBiasGate(metrics, gc)

      const accuracyNorm = Math.min(metrics.accuracy / targetAccuracy, 1)

      const perfScore =
        weights.rocksDestroyed * rocksNorm + weights.accuracy * accuracyNorm

      const fitness = weightedFitnessSum(metrics, weights, gc, {
        possibleDeaths: fgSeedPossibleDeaths,
        dtMs: options.dtMs,
      })

      perFullGame.push({
        fitness,
        perfScore,
        rocksNorm,
        accuracy: metrics.accuracy,
        accuracyNorm,
        survivalTerm,
        actionGateVal,
        turnGateVal,
        turnBiasVal,
        rocksDestroyed: metrics.rocksDestroyed,
        uniqueRocksSeen: metrics.uniqueRocksSeen,
        effectiveMaxRocks,
        deaths: metrics.deaths,
        shotsFired: metrics.shotsFired,
        shotsHit: metrics.shotsHit,
        aliveFrames: metrics.aliveFrames,
      })
    }

    // ── Aggregate scenario stats ──
    const n = perScenario.length
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
    const sum = (arr) => arr.reduce((a, b) => a + b, 0)

    const meanScenarioFitness = avg(perScenario.map((s) => s.fitness))
    const meanPerfScore = avg(perScenario.map((s) => s.perfScore))
    const meanRocksNorm = avg(perScenario.map((s) => s.rocksNorm))
    const meanAccuracy = avg(perScenario.map((s) => s.accuracy))
    const meanAccuracyNorm = avg(perScenario.map((s) => s.accuracyNorm))
    const meanSurvival = avg(perScenario.map((s) => s.survivalTerm))
    const meanActionGate = avg(perScenario.map((s) => s.actionGateVal))
    const meanTurnGate = avg(perScenario.map((s) => s.turnGateVal))
    const meanTurnBias = avg(perScenario.map((s) => s.turnBiasVal))
    const meanEffectiveMax = avg(perScenario.map((s) => s.effectiveMaxRocks))
    const meanUniqueRocksSeen = avg(perScenario.map((s) => s.uniqueRocksSeen))
    const totalRocks = sum(perScenario.map((p) => p.rocksDestroyed))
    const totalDeaths = sum(perScenario.map((p) => p.deaths))
    const totalShots = sum(perScenario.map((p) => p.shotsFired))
    const totalHits = sum(perScenario.map((p) => p.shotsHit))

    // ── Aggregate full game stats ──
    const fg = perFullGame.length
    const meanFgFitness = fg > 0 ? avg(perFullGame.map((s) => s.fitness)) : 0
    const meanFgPerfScore =
      fg > 0 ? avg(perFullGame.map((s) => s.perfScore)) : 0
    const meanFgRocksNorm =
      fg > 0 ? avg(perFullGame.map((s) => s.rocksNorm)) : 0
    const meanFgAccuracyNorm =
      fg > 0 ? avg(perFullGame.map((s) => s.accuracyNorm)) : 0
    const meanFgSurvival =
      fg > 0 ? avg(perFullGame.map((s) => s.survivalTerm)) : 0
    const meanFgActionGate =
      fg > 0 ? avg(perFullGame.map((s) => s.actionGateVal)) : 0
    const meanFgTurnGate =
      fg > 0 ? avg(perFullGame.map((s) => s.turnGateVal)) : 0
    const meanFgTurnBias =
      fg > 0 ? avg(perFullGame.map((s) => s.turnBiasVal)) : 0
    const meanFgEffectiveMax =
      fg > 0 ? avg(perFullGame.map((s) => s.effectiveMaxRocks)) : 0
    const meanFgUniqueRocksSeen =
      fg > 0 ? avg(perFullGame.map((s) => s.uniqueRocksSeen)) : 0
    const totalFgRocks = sum(perFullGame.map((p) => p.rocksDestroyed))
    const totalFgDeaths = sum(perFullGame.map((p) => p.deaths))
    const totalFgShots = sum(perFullGame.map((p) => p.shotsFired))
    const totalFgHits = sum(perFullGame.map((p) => p.shotsHit))

    // ── Aggregated behavioral gates ──
    const aggMetrics = { ...aggFrames }
    const aggActionGate = actionDiversityGate(aggMetrics, gc)
    const aggTurnGate = turnGate(aggMetrics, gc)
    const aggTurnBiasGate = turnBiasGate(aggMetrics, gc)

    // ── Blended fitness ──
    const blendedFitnessRaw =
      sw * meanScenarioFitness + fw * meanFgFitness + cw * curriculumFitness
    const blendedFitness = applyBehavioralGates(
      blendedFitnessRaw,
      aggMetrics,
      gc
    )

    // ── Print: Scenario Fitness ──
    console.log(`\n=== Scenario Fitness (${n} scenarios) ===`)
    console.log(`  scenarioFitness:  ${fmtNum(meanScenarioFitness)}`)

    console.log(`\n  ── Performance Components ──`)
    console.log(`  perfScore (weighted sum):   ${fmtNum(meanPerfScore)}`)
    console.log(
      `    rocksNorm:    ${fmtNum(meanRocksNorm)}  (w=${weights.rocksDestroyed} → ${fmtNum(weights.rocksDestroyed * meanRocksNorm)})`
    )
    console.log(
      `    accuracyNorm: ${fmtNum(meanAccuracyNorm)}  (w=${weights.accuracy} → ${fmtNum(weights.accuracy * meanAccuracyNorm)})  raw=${fmtNum(meanAccuracy)} target=${weights.targetAccuracy}`
    )

    console.log(`\n  ── Gates (multiplicative) ──`)
    console.log(`  actionGate:     ${fmtNum(meanActionGate)}`)
    console.log(`  turnGate:       ${fmtNum(meanTurnGate)}`)
    console.log(`  turnBiasGate:   ${fmtNum(meanTurnBias)}`)
    console.log(`  survivalGate:   ${fmtNum(meanSurvival)}`)

    console.log(`\n  ── Rock Budget (fire-rate based) ──`)
    console.log(
      `  mean uniqueRocksSeen:        ${fmtNum(meanUniqueRocksSeen, 1)}`
    )
    console.log(`  mean possibleKills:          ${fmtNum(meanEffectiveMax, 1)}`)
    console.log(`  mean rocksDestroyed:         ${fmtNum(totalRocks / n, 1)}`)

    console.log(`\n  ── Totals ──`)
    console.log(
      `  rocksDestroyed: ${totalRocks}  deaths: ${totalDeaths}  shots: ${totalShots}  hits: ${totalHits}  accuracy: ${totalShots > 0 ? pct(totalHits / totalShots) : 'n/a'}`
    )

    // ── Print: Full Game Fitness ──
    console.log(
      `\n=== Full Game Fitness (${fg} seeds, maxTicks=${options.maxTicks}) ===`
    )
    console.log(
      `  maxPossibleDeaths: ${fgPossibleDeaths} (theoretical max; actual computed per-seed from elapsedTicks)`
    )
    console.log(`  fullGameFitness:  ${fmtNum(meanFgFitness)}`)

    console.log(`\n  ── Performance Components ──`)
    console.log(`  perfScore (weighted sum):   ${fmtNum(meanFgPerfScore)}`)
    console.log(
      `    rocksNorm:    ${fmtNum(meanFgRocksNorm)}  (w=${weights.rocksDestroyed} → ${fmtNum(weights.rocksDestroyed * meanFgRocksNorm)})`
    )
    console.log(
      `    accuracyNorm: ${fmtNum(meanFgAccuracyNorm)}  (w=${weights.accuracy} → ${fmtNum(weights.accuracy * meanFgAccuracyNorm)})`
    )

    console.log(`\n  ── Gates (multiplicative) ──`)
    console.log(`  actionGate:     ${fmtNum(meanFgActionGate)}`)
    console.log(`  turnGate:       ${fmtNum(meanFgTurnGate)}`)
    console.log(`  turnBiasGate:   ${fmtNum(meanFgTurnBias)}`)
    console.log(`  survivalGate:   ${fmtNum(meanFgSurvival)}`)

    console.log(`\n  ── Rock Budget (fire-rate based) ──`)
    console.log(
      `  mean uniqueRocksSeen:        ${fmtNum(meanFgUniqueRocksSeen, 1)}`
    )
    console.log(
      `  mean possibleKills:          ${fmtNum(meanFgEffectiveMax, 1)}`
    )
    console.log(
      `  mean rocksDestroyed:         ${fg > 0 ? fmtNum(totalFgRocks / fg, 1) : '0.0'}`
    )
    console.log(
      `  mean deaths:                 ${fg > 0 ? fmtNum(totalFgDeaths / fg, 1) : '0.0'}`
    )

    console.log(`\n  ── Totals ──`)
    console.log(
      `  rocksDestroyed: ${totalFgRocks}  deaths: ${totalFgDeaths}  shots: ${totalFgShots}  hits: ${totalFgHits}  accuracy: ${totalFgShots > 0 ? pct(totalFgHits / totalFgShots) : 'n/a'}`
    )

    // ── Print: Curriculum Fitness ──
    if (options.curriculum) {
      console.log(`\n=== Curriculum Fitness ===`)
      console.log(
        `  ${curriculumKills}/${curriculumTotal} kills → avgFitness=${fmtNum(curriculumFitness)}`
      )
    }

    // ── Print: Blended Fitness ──
    console.log(`\n=== Blended Fitness ===`)
    console.log(
      `  rawBlended:   ${fmtNum(blendedFitnessRaw)}  (before aggregated gates)`
    )
    console.log(
      `  scenario × ${fmtNum(sw, 2)} + fullGame × ${fmtNum(fw, 2)} + curriculum × ${fmtNum(cw, 2)} = ${fmtNum(blendedFitnessRaw)}`
    )
    console.log(
      `    scenario:   ${fmtNum(meanScenarioFitness)} × ${fmtNum(sw, 2)} = ${fmtNum(sw * meanScenarioFitness)}`
    )
    console.log(
      `    fullGame:   ${fmtNum(meanFgFitness)} × ${fmtNum(fw, 2)} = ${fmtNum(fw * meanFgFitness)}`
    )
    if (options.curriculum) {
      console.log(
        `    curriculum: ${fmtNum(curriculumFitness)} × ${fmtNum(cw, 2)} = ${fmtNum(cw * curriculumFitness)}`
      )
    }

    // ── Print: Aggregated Behavioral Gates ──
    console.log(`\n=== Aggregated Behavioral Gates ===`)
    console.log(`  totalAliveFrames: ${aggFrames.aliveFrames}`)
    if (aggFrames.aliveFrames > 0) {
      console.log(
        `  thrust: ${pct(aggFrames.thrustFrames / aggFrames.aliveFrames)}  fire: ${pct(aggFrames.fireFrames / aggFrames.aliveFrames)}  left: ${pct(aggFrames.leftFrames / aggFrames.aliveFrames)}  right: ${pct(aggFrames.rightFrames / aggFrames.aliveFrames)}`
      )
    }
    console.log(`  actionGate:     ${fmtNum(aggActionGate)}`)
    console.log(`  turnGate:       ${fmtNum(aggTurnGate)}`)
    console.log(`  turnBiasGate:   ${fmtNum(aggTurnBiasGate)}`)
    console.log(`  gatedFitness:   ${fmtNum(blendedFitness)}`)

    agentData.push({
      name,
      meanScenarioFitness,
      meanFgFitness,
      curriculumFitness,
      blendedFitnessRaw,
      blendedFitness,
      meanPerfScore,
      meanRocksNorm,
      meanAccuracy,
      meanAccuracyNorm,
      meanSurvival,
      meanActionGate,
      meanTurnGate,
      meanTurnBias,
      aggActionGate,
      aggTurnGate,
      aggTurnBiasGate,
      meanEffectiveMax,
      meanUniqueRocksSeen,
      meanFgSurvival,
      meanFgPerfScore,
    })
    console.log()
  }

  // Comparison table across all agents
  if (agentData.length >= 2) {
    const colWidth = 12
    const labelWidth = 22
    const columns = agentData

    const rowDefs = [
      ['scenarioFitness', (d) => d.meanScenarioFitness],
      ['fullGameFitness', (d) => d.meanFgFitness],
      ...(options.curriculum
        ? [['curriculumFitness', (d) => d.curriculumFitness]]
        : []),
      ['blendedRaw', (d) => d.blendedFitnessRaw],
      ['blendedFitness', (d) => d.blendedFitness],
      ['perfScore', (d) => d.meanPerfScore],
      ['rocksNorm', (d) => d.meanRocksNorm],
      ['accuracyNorm', (d) => d.meanAccuracyNorm],
      ['accuracyRaw', (d) => d.meanAccuracy],
      ['survivalGate(scn)', (d) => d.meanSurvival],
      ['survivalGate(fg)', (d) => d.meanFgSurvival],
      ['actionGate(avg)', (d) => d.meanActionGate],
      ['turnGate(avg)', (d) => d.meanTurnGate],
      ['turnBiasGate(avg)', (d) => d.meanTurnBias],
      ['actionGate(agg)', (d) => d.aggActionGate],
      ['turnGate(agg)', (d) => d.aggTurnGate],
      ['turnBiasGate(agg)', (d) => d.aggTurnBiasGate],
      ['possibleKills', (d) => d.meanEffectiveMax],
      ['uniqueRocksSeen', (d) => d.meanUniqueRocksSeen],
    ]

    const tableWidth = labelWidth + 2 + columns.length * colWidth
    console.log(`${'═'.repeat(tableWidth)}`)
    console.log(`  COMPARISON`)
    console.log(`${'═'.repeat(tableWidth)}`)
    console.log()

    // Header
    const header =
      `  ${pad('Component', labelWidth)}` +
      columns.map((c) => pad(c.name, colWidth)).join('')
    console.log(header)
    console.log(`  ${'─'.repeat(tableWidth - 2)}`)

    for (const [label, getter] of rowDefs) {
      const values = columns.map((c) => getter(c))
      const line =
        `  ${pad(label, labelWidth)}` +
        values.map((v) => pad(fmtNum(v), colWidth)).join('')
      console.log(line)
    }

    console.log()
  }

  console.log(`${'═'.repeat(72)}`)
  console.log(`=== Done ===\n`)
}

main().catch((error) => {
  console.error('inspect-fitness failed:', error)
  process.exit(1)
})
