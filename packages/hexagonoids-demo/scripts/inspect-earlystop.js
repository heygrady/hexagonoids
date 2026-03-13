/**
 * Diagnostic script: measure how often the "zero known rocks" early stop fires.
 *
 * Replays genomes (or baseline agents) through the scenario gauntlet and
 * curriculum, replicating the simulation loop with instrumentation to count
 * early-stop events.
 *
 * Usage:
 *   node packages/hexagonoids-demo/scripts/inspect-earlystop.js [options]
 *
 * Options:
 *   --genome <path>              single genome JSON file
 *   --genomeDir <path>           directory of genome JSON files (replays all)
 *   --method <method>            default: 'HyperNEAT'
 *   --agent <random|doNothing>   baseline agent (default: skip baselines unless no genome)
 *   --scenariosPerRun <n>        default: 100
 *   --scenarioMaxTicks <n>       default: 120
 *   --seed <seed>                default: 'inspect-earlystop-001'
 *   --dtMs <n>                   default: 33
 *   --curriculum                 also run curriculum scenarios
 *   --curriculumCount <n>        default: from config
 *   --verbose                    print per-scenario details
 *   --limit <n>                  max genomes to load from --genomeDir
 */
import { readdirSync, readFileSync } from 'node:fs'
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

function parseArgs(argv, envDefaults) {
  const options = {
    genome: undefined,
    genomeDir: undefined,
    method: 'HyperNEAT',
    agent: undefined,
    scenariosPerRun: 100,
    scenarioMaxTicks: 120,
    seed: 'inspect-earlystop-001',
    dtMs: envDefaults.simulation.dtMs,
    curriculum: false,
    curriculumCount: envDefaults.simulation.curriculumCount,
    verbose: false,
    limit: Infinity,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--genome' && argv[i + 1]) options.genome = argv[++i]
    else if (arg === '--genomeDir' && argv[i + 1]) options.genomeDir = argv[++i]
    else if (arg === '--method' && argv[i + 1]) options.method = argv[++i]
    else if (arg === '--agent' && argv[i + 1]) options.agent = argv[++i]
    else if (arg === '--scenariosPerRun' && argv[i + 1])
      options.scenariosPerRun = Number(argv[++i])
    else if (arg === '--scenarioMaxTicks' && argv[i + 1])
      options.scenarioMaxTicks = Number(argv[++i])
    else if (arg === '--seed' && argv[i + 1]) options.seed = argv[++i]
    else if (arg === '--dtMs' && argv[i + 1]) options.dtMs = Number(argv[++i])
    else if (arg === '--curriculum') options.curriculum = true
    else if (arg === '--curriculumCount' && argv[i + 1])
      options.curriculumCount = Number(argv[++i])
    else if (arg === '--verbose') options.verbose = true
    else if (arg === '--limit' && argv[i + 1]) options.limit = Number(argv[++i])
  }
  return options
}

function pad(str, len) {
  return String(str).padEnd(len)
}

/**
 * Run the scenario simulation loop with early-stop instrumentation.
 * Returns { ticks, earlyStopReason } where reason is:
 *   'maxTicks' | 'gameEnded' | 'zeroKnownRocks'
 */
function simulateScenarioInstrumented(
  env,
  agent,
  scenario,
  maxTicks,
  dtMs,
  seed,
  executor
) {
  const {
    restoreSnapshot,
    MEMORY_ROCK_PERCEPTION,
    MEMORY_SEEN_ROCKS,
    buildRockPerceptionPrecompute,
    yawToBearing,
  } = env

  const PLAYER_ID = 'player-1'
  const engine = restoreSnapshot(scenario, seed)
  const { state, rng } = engine

  const context = { rng, memory: {}, executor, spatialQueries: engine }
  const stepInputs = {
    [PLAYER_ID]: { left: false, right: false, thrust: false, fire: false },
  }

  let hasSeenRock = false
  let earlyStopReason = 'maxTicks'

  for (let tick = 0; tick < maxTicks; tick++) {
    if (state.endedAt != null) {
      earlyStopReason = 'gameEnded'
      return { ticks: tick, earlyStopReason }
    }

    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined

    const rockPerception =
      ship?.alive === true
        ? buildRockPerceptionPrecompute(ship, yawToBearing(ship.yaw), engine)
        : undefined
    context.memory[MEMORY_ROCK_PERCEPTION] = rockPerception

    const inputs = agent(state, PLAYER_ID, context)

    // Track visible rocks
    if (rockPerception != null && rockPerception.rocks.length > 0) {
      for (const entry of rockPerception.rocks) {
        if (entry.inVisionRange) {
          hasSeenRock = true
          break
        }
      }
    }

    // Check zero-known-rocks early stop (same logic as simulateScenario)
    if (hasSeenRock && ship?.alive) {
      const hasVisibleRocks =
        rockPerception != null &&
        rockPerception.rocks.some((r) => r.inVisionRange)
      if (!hasVisibleRocks) {
        const seenRocks = context.memory[MEMORY_SEEN_ROCKS]
        if (seenRocks == null || seenRocks.size === 0) {
          earlyStopReason = 'zeroKnownRocks'
          return { ticks: tick, earlyStopReason }
        }
      }
    }

    stepInputs[PLAYER_ID] = inputs
    engine.tick(stepInputs, dtMs)
  }

  return { ticks: maxTicks, earlyStopReason }
}

/**
 * Run a curriculum scenario with early-stop instrumentation.
 */
function simulateCurriculumInstrumented(
  env,
  enginePkg,
  agent,
  params,
  seed,
  dtMs,
  executor
) {
  const {
    MEMORY_ROCK_PERCEPTION,
    MEMORY_SEEN_ROCKS,
    buildRockPerceptionPrecompute,
    yawToBearing,
  } = env

  // Import curriculum creator from dist
  const { createCurriculumGameState } = enginePkg

  const PLAYER_ID = 'player-1'
  const { engine, maxTicks } = createCurriculumGameState(params, seed, dtMs)
  const { state, rng } = engine

  const context = { rng, memory: {}, executor, spatialQueries: engine }
  const stepInputs = {
    [PLAYER_ID]: { left: false, right: false, thrust: false, fire: false },
  }

  let hasSeenRock = false
  let earlyStopReason = 'maxTicks'

  for (let tick = 0; tick < maxTicks; tick++) {
    if (state.endedAt != null) {
      return { ticks: tick, earlyStopReason: 'gameEnded' }
    }
    if (state.rocks.size === 0) {
      return { ticks: tick, earlyStopReason: 'rocksCleared' }
    }
    const trackedPlayer = state.players.get(PLAYER_ID)
    if (trackedPlayer != null && !trackedPlayer.alive) {
      return { ticks: tick, earlyStopReason: 'playerDied' }
    }

    const ship =
      trackedPlayer?.shipId != null
        ? state.ships.get(trackedPlayer.shipId)
        : undefined

    const rockPerception =
      ship?.alive === true
        ? buildRockPerceptionPrecompute(ship, yawToBearing(ship.yaw), engine)
        : undefined
    context.memory[MEMORY_ROCK_PERCEPTION] = rockPerception

    const inputs = agent(state, PLAYER_ID, context)

    if (rockPerception != null && rockPerception.rocks.length > 0) {
      for (const entry of rockPerception.rocks) {
        if (entry.inVisionRange) {
          hasSeenRock = true
          break
        }
      }
    }

    if (hasSeenRock && ship?.alive) {
      const hasVisibleRocks =
        rockPerception != null &&
        rockPerception.rocks.some((r) => r.inVisionRange)
      if (!hasVisibleRocks) {
        const seenRocks = context.memory[MEMORY_SEEN_ROCKS]
        if (seenRocks == null || seenRocks.size === 0) {
          earlyStopReason = 'zeroKnownRocks'
          return { ticks: tick, earlyStopReason }
        }
      }
    }

    stepInputs[PLAYER_ID] = inputs
    engine.tick(stepInputs, dtMs)
  }

  return { ticks: maxTicks, earlyStopReason }
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
    createNeatAgent,
  } = env
  const { createRNG } = await import('@neat-evolution/utils')

  // Load scenario bank
  const scenariosPath = resolve(packageRoot, 'src/data/scenarioBank.js')
  const scenarioBank = decodeScenarioBankDocument(
    readScenarioBank(scenariosPath)
  )

  // Select scenarios
  const selectionRng = createRNG(options.seed)
  const count = Math.min(options.scenariosPerRun, scenarioBank.length)
  const selected = []
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

  // Load curriculum generator if needed
  let curriculumPkg
  let curriculumParams = []
  if (options.curriculum) {
    curriculumPkg = await import(
      '../dist/esm/curriculum/generateCurriculumScenario.js'
    )
    const { buildCurriculumParams } = env
    curriculumParams = buildCurriculumParams(
      options.curriculumCount,
      options.seed
    )
  }

  console.log(`\n=== Early-Stop Inspection ===`)
  console.log(
    `seed="${options.seed}" scenarios=${selected.length}/${scenarioBank.length} ` +
      `maxTicks=${options.scenarioMaxTicks} dtMs=${options.dtMs}`
  )
  if (options.curriculum) {
    console.log(`curriculum: ${curriculumParams.length} scenarios`)
  }
  console.log()

  // Build agent list
  const agents = []

  // Baseline agents
  if (options.agent === 'doNothing' || options.agent === 'random') {
    if (options.agent === 'doNothing')
      agents.push({
        name: 'doNothing',
        agent: doNothingAgent,
        executor: undefined,
      })
    else
      agents.push({ name: 'random', agent: randomAgent, executor: undefined })
  } else if (!options.genome && !options.genomeDir) {
    // No genome specified — run both baselines
    agents.push({
      name: 'doNothing',
      agent: doNothingAgent,
      executor: undefined,
    })
    agents.push({ name: 'random', agent: randomAgent, executor: undefined })
  }

  // Load genome(s)
  const genomePaths = []
  if (options.genome) {
    genomePaths.push(resolve(options.genome))
  }
  if (options.genomeDir) {
    const dir = resolve(options.genomeDir)
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .slice(0, options.limit)
    for (const f of files) {
      genomePaths.push(resolve(dir, f))
    }
  }

  if (genomePaths.length > 0) {
    const { loadGenome } = await import('../dist/esm/persistence/loadGenome.js')
    const {
      createGenomeFromSerialized,
      HEXAGONOIDS_IO,
      createPhenotypeForGenome,
    } = await import('../dist/esm/algorithmRegistry.js')
    const { createExecutor } = await import('@neat-evolution/executor')

    const isRecord = (v) => v != null && typeof v === 'object'

    for (const gPath of genomePaths) {
      const serialized = loadGenome(gPath)
      const genomeData = serialized.genome
      const genomeOptions = genomeData.genomeOptions
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

      const label = gPath.split('/').pop().replace('.json', '')
      agents.push({ name: label, agent, executor })
    }
  }

  if (agents.length === 0) {
    console.error(
      'No agents to evaluate. Use --genome, --genomeDir, or --agent.'
    )
    process.exit(1)
  }

  console.log(`Agents: ${agents.map((a) => a.name).join(', ')}`)
  console.log()

  // Run evaluations
  for (const { name, agent, executor } of agents) {
    console.log(`${'─'.repeat(72)}`)
    console.log(`Agent: ${name}`)
    console.log(`${'─'.repeat(72)}`)

    // ── Scenario gauntlet ──
    const scenarioReasons = {}
    const scenarioTickSaved = []
    let scenarioTotalTicks = 0

    for (const scenario of selected) {
      const result = simulateScenarioInstrumented(
        env,
        agent,
        scenario,
        options.scenarioMaxTicks,
        options.dtMs,
        options.seed,
        executor
      )
      scenarioReasons[result.earlyStopReason] =
        (scenarioReasons[result.earlyStopReason] || 0) + 1
      scenarioTotalTicks += result.ticks

      if (result.earlyStopReason === 'zeroKnownRocks') {
        scenarioTickSaved.push(options.scenarioMaxTicks - result.ticks)
        if (options.verbose) {
          console.log(
            `  scenario: stopped at tick ${result.ticks}/${options.scenarioMaxTicks} (${result.earlyStopReason})`
          )
        }
      }
    }

    const maxPossibleTicks = selected.length * options.scenarioMaxTicks
    const ticksSaved = scenarioTickSaved.reduce((a, b) => a + b, 0)
    const pctSaved =
      maxPossibleTicks > 0 ? (ticksSaved / maxPossibleTicks) * 100 : 0

    console.log(
      `\n  Scenarios (${selected.length} runs, maxTicks=${options.scenarioMaxTicks}):`
    )
    console.log(`    Stop reasons:`)
    for (const [reason, count] of Object.entries(scenarioReasons).sort()) {
      const pct = ((count / selected.length) * 100).toFixed(1)
      console.log(
        `      ${pad(reason, 20)} ${count}/${selected.length} (${pct}%)`
      )
    }
    console.log(
      `    Total ticks run:    ${scenarioTotalTicks} / ${maxPossibleTicks}`
    )
    console.log(
      `    Ticks saved:        ${ticksSaved} (${pctSaved.toFixed(1)}%)`
    )
    if (scenarioTickSaved.length > 0) {
      const avgSaved = ticksSaved / scenarioTickSaved.length
      const minSaved = Math.min(...scenarioTickSaved)
      const maxSaved = Math.max(...scenarioTickSaved)
      console.log(
        `    Per early-stop:     avg=${avgSaved.toFixed(1)} min=${minSaved} max=${maxSaved} ticks saved`
      )
    }

    // ── Curriculum ──
    if (options.curriculum && curriculumParams.length > 0) {
      const currReasons = {}
      const currTickSaved = []
      let currTotalTicks = 0
      let currMaxPossible = 0

      for (const params of curriculumParams) {
        const result = simulateCurriculumInstrumented(
          env,
          curriculumPkg,
          agent,
          params,
          options.seed,
          options.dtMs,
          executor
        )
        currReasons[result.earlyStopReason] =
          (currReasons[result.earlyStopReason] || 0) + 1
        currTotalTicks += result.ticks
        // We don't know maxTicks per curriculum scenario easily, estimate from result
        const estimatedMax =
          result.earlyStopReason === 'maxTicks'
            ? result.ticks
            : result.ticks + 1
        currMaxPossible += result.ticks // conservative: count actual ticks

        if (result.earlyStopReason === 'zeroKnownRocks' && options.verbose) {
          console.log(
            `  curriculum: stopped at tick ${result.ticks} (${result.earlyStopReason})`
          )
        }
      }

      console.log(`\n  Curriculum (${curriculumParams.length} scenarios):`)
      console.log(`    Stop reasons:`)
      for (const [reason, count] of Object.entries(currReasons).sort()) {
        const pct = ((count / curriculumParams.length) * 100).toFixed(1)
        console.log(
          `      ${pad(reason, 20)} ${count}/${curriculumParams.length} (${pct}%)`
        )
      }
    }

    console.log()
  }

  // ── Summary table ──
  if (agents.length > 1) {
    console.log(`${'═'.repeat(72)}`)
    console.log(`Summary`)
    console.log(`${'═'.repeat(72)}`)
    // Re-run in compact form just for summary — or we could have stored above.
    // Kept simple: the per-agent output above is the primary output.
  }

  console.log(`=== Done ===\n`)
}

main().catch((error) => {
  console.error('inspect-earlystop failed:', error)
  process.exit(1)
})
