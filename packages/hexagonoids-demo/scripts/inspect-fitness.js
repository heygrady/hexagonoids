/**
 * Diagnostic script: inspect scenario fitness scoring breakdown.
 *
 * Runs scenario evaluation with different agents (doNothing, random) and
 * compares the current scoring against alternatives that follow best practices.
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

function saturating(value, scale) {
  if (value <= 0 || scale <= 0) return 0
  return 1 - Math.exp(-value / scale)
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function actionSaturationScore(
  actionFrames,
  aliveFrames,
  low,
  high,
  steepness
) {
  if (aliveFrames <= 0) return 0
  const fraction = actionFrames / aliveFrames
  const lowPenalty = 1 - Math.exp(-steepness * (fraction / Math.max(low, 1e-9)))
  const highPenalty =
    fraction <= high
      ? 1
      : Math.exp(-steepness * ((fraction - high) / (1 - high + 1e-9)))
  return lowPenalty * highPenalty
}

function computeActionGate(m, gc) {
  const alive = m.aliveFrames
  const thrustSat = actionSaturationScore(
    m.thrustFrames,
    alive,
    gc.actionLow,
    gc.actionHigh,
    gc.actionSteepness
  )
  const fireSat = actionSaturationScore(
    m.fireFrames,
    alive,
    gc.actionLow,
    gc.actionHigh,
    gc.actionSteepness
  )
  const leftSat = actionSaturationScore(
    m.leftFrames,
    alive,
    gc.actionLow,
    gc.actionHigh,
    gc.actionSteepness
  )
  const rightSat = actionSaturationScore(
    m.rightFrames,
    alive,
    gc.actionLow,
    gc.actionHigh,
    gc.actionSteepness
  )
  const geoMean = (thrustSat * fireSat * leftSat * rightSat) ** 0.25
  return {
    thrustSat,
    fireSat,
    leftSat,
    rightSat,
    geoMean,
    gate: Math.max(geoMean, gc.floor),
  }
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

// ═══════════════════════════════════════════════════════════════════════
// Scoring methods
// ═══════════════════════════════════════════════════════════════════════

/**
 * Current: quality(scoreEff, livesRem, rocksDestr, cellsVisited) × actionGate × engagementGate × survivalGate(deaths)
 */
function scoreCurrent(m, gc, ctx) {
  const scoreComp = saturating(m.score, 1050 * 10)
  const livesComp = clamp(m.livesRemaining / 3, 0, 1)
  const rocksComp = saturating(m.rocksDestroyed, 25)
  const cellsComp = clamp(m.uniqueCellsVisited / gc.cellsCoverageTarget, 0, 1)
  const quality =
    0.35 * scoreComp + 0.2 * livesComp + 0.3 * rocksComp + 0.15 * cellsComp

  const action = computeActionGate(m, gc)
  const soiFraction =
    m.aliveFrames > 0 ? clamp(m.framesWithRocksInSOI / m.aliveFrames, 0, 1) : 0
  const engGate = Math.max(soiFraction, gc.floor)
  const deathsRaw = Math.exp(-m.deaths / Math.max(gc.deathScale, 1e-9))
  const survGate = Math.max(deathsRaw, gc.floor)

  return {
    label: 'Current',
    fitness: clamp(quality * action.gate * engGate * survGate, 0, 1),
    quality,
    detail: `q=${fmtNum(quality)} × aG=${fmtNum(action.gate)} × eG=${fmtNum(engGate)} × sG=${fmtNum(survGate)}`,
    components: {
      'scoreEff (w=.35)': scoreComp,
      'livesRem (w=.20)': livesComp,
      'rocksDestr(w=.30)': rocksComp,
      'cellsVis (w=.15)': cellsComp,
    },
  }
}

/**
 * Alt A: Minimal — only proven-signal quality components, single gate.
 * Drops livesRem (always 0), cellsVisited (always maxed), engagement gate, survival gate.
 */
function scoreAltA(m, gc, ctx) {
  const scoreComp = saturating(m.score, 1050 * 10)
  const rocksComp = saturating(m.rocksDestroyed, 25)
  const quality = 0.5 * scoreComp + 0.5 * rocksComp

  const action = computeActionGate(m, gc)
  return {
    label: 'Alt A: Minimal',
    fitness: clamp(quality * action.gate, 0, 1),
    quality,
    detail: `q=${fmtNum(quality)} × aG=${fmtNum(action.gate)}`,
    components: {
      'scoreEff (w=.50)': scoreComp,
      'rocksDestr(w=.50)': rocksComp,
    },
  }
}

/**
 * Alt B: Research-aligned — accuracy + survival ratio in quality.
 * survivalScore = 1 - deaths/possibleDeaths (accounts for starting lives per scenario)
 * accuracy as quality component (key skill signal per RESEARCH.md §4)
 */
function scoreAltB(m, gc, ctx) {
  const scoreComp = saturating(m.score, 1050 * 10)
  const rocksComp = saturating(m.rocksDestroyed, 25)
  const accuracyComp = m.accuracy
  const survivalComp =
    ctx.possibleDeaths > 0 ? 1 - m.deaths / ctx.possibleDeaths : 1
  const quality =
    0.35 * scoreComp +
    0.3 * rocksComp +
    0.2 * accuracyComp +
    0.15 * survivalComp

  const action = computeActionGate(m, gc)
  return {
    label: 'Alt B: Acc+Survival',
    fitness: clamp(quality * action.gate, 0, 1),
    quality,
    detail: `q=${fmtNum(quality)} × aG=${fmtNum(action.gate)}`,
    components: {
      'scoreEff (w=.35)': scoreComp,
      'rocksDestr(w=.30)': rocksComp,
      'accuracy  (w=.20)': accuracyComp,
      'survival  (w=.15)': survivalComp,
      '  deaths/possible':
        ctx.possibleDeaths > 0 ? m.deaths / ctx.possibleDeaths : 0,
    },
  }
}

/**
 * Alt C: Multiplicative — Code Bullet style geometric mean.
 * Zero in any dimension collapses fitness. Epsilon on accuracy
 * prevents total collapse before agents learn to aim.
 */
function scoreAltC(m, gc, ctx) {
  const scoreNorm = saturating(m.score, 5000)
  const rocksNorm = saturating(m.rocksDestroyed, 15)
  const accuracyTerm = m.accuracy + 0.01
  const survivalTerm =
    ctx.possibleDeaths > 0 ? 1 - m.deaths / ctx.possibleDeaths : 1

  const perfScore =
    (scoreNorm * rocksNorm * accuracyTerm * survivalTerm) ** 0.25

  const action = computeActionGate(m, gc)
  return {
    label: 'Alt C: Multiplicative',
    fitness: clamp(perfScore * action.gate, 0, 1),
    quality: perfScore,
    detail: `perf=${fmtNum(perfScore)} × aG=${fmtNum(action.gate)}  (gmean: score×rocks×acc×surv)`,
    components: {
      scoreNorm: scoreNorm,
      rocksNorm: rocksNorm,
      accuracyTerm: accuracyTerm,
      survivalTerm: survivalTerm,
    },
  }
}

/**
 * Alt D: Earned cells — fixes cellsVisited for scenarios.
 * earnedCells = totalCells - numScenarios - deaths (subtract free starting + regen cells)
 * Per-scenario cell budget: maxSpeed × scenarioDuration / bucketDiameter
 * survivalScore = 1 - deaths/possibleDeaths
 */
function scoreAltD(m, gc, ctx) {
  const scoreComp = saturating(m.score, 1050 * 10)
  const rocksComp = saturating(m.rocksDestroyed, 25)
  const accuracyComp = m.accuracy
  const survivalComp =
    ctx.possibleDeaths > 0 ? 1 - m.deaths / ctx.possibleDeaths : 1

  // Corrected cellsVisited: subtract free starting + regeneration cells
  const earnedCells = Math.max(
    m.uniqueCellsVisited - ctx.numScenarios - m.deaths,
    0
  )
  const cellsComp = clamp(earnedCells / ctx.cellBudget, 0, 1)

  const quality =
    0.3 * scoreComp +
    0.25 * rocksComp +
    0.2 * accuracyComp +
    0.15 * survivalComp +
    0.1 * cellsComp

  const action = computeActionGate(m, gc)
  return {
    label: 'Alt D: EarnedCells',
    fitness: clamp(quality * action.gate, 0, 1),
    quality,
    detail: `q=${fmtNum(quality)} × aG=${fmtNum(action.gate)}`,
    components: {
      'scoreEff (w=.30)': scoreComp,
      'rocksDestr(w=.25)': rocksComp,
      'accuracy  (w=.20)': accuracyComp,
      'survival  (w=.15)': survivalComp,
      'cells     (w=.10)': cellsComp,
      '  earnedCells': earnedCells,
      '  cellBudget': ctx.cellBudget,
    },
  }
}

/**
 * Alt E: Combined best — Alt B quality + survival gate.
 * Quality handles "how well" (score, rocks, accuracy).
 * Gates handle "did you play" (actions, survival).
 * Keeps gate architecture from RESEARCH.md §4 for multiplicative preconditions.
 */
function scoreAltE(m, gc, ctx) {
  const scoreComp = saturating(m.score, 1050 * 10)
  const rocksComp = saturating(m.rocksDestroyed, 25)
  const accuracyComp = m.accuracy
  // Quality: only skill/performance metrics
  const quality = 0.4 * scoreComp + 0.35 * rocksComp + 0.25 * accuracyComp

  const action = computeActionGate(m, gc)
  // Survival as gate: 1 - deaths/possibleDeaths, with floor
  const survivalRaw =
    ctx.possibleDeaths > 0 ? 1 - m.deaths / ctx.possibleDeaths : 1
  const survGate = Math.max(survivalRaw, gc.floor)

  return {
    label: 'Alt E: Quality×Gates',
    fitness: clamp(quality * action.gate * survGate, 0, 1),
    quality,
    detail: `q=${fmtNum(quality)} × aG=${fmtNum(action.gate)} × sG=${fmtNum(survGate)}`,
    components: {
      'scoreEff (w=.40)': scoreComp,
      'rocksDestr(w=.35)': rocksComp,
      'accuracy  (w=.25)': accuracyComp,
      survGate: survGate,
      '  deaths/possible':
        ctx.possibleDeaths > 0 ? m.deaths / ctx.possibleDeaths : 0,
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════

async function main() {
  const options = parseArgs(process.argv.slice(2))

  const env = await import('@heygrady/hexagonoids-environment')
  const {
    doNothingAgent,
    randomAgent,
    simulateScenario,
    aggregateMetrics,
    weightedFitnessSum,
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

  console.log(`\n=== Scenario Fitness Inspection ===`)
  console.log(
    `scenariosPerOrganism=${scenariosPerOrganism} scenarioMaxTicks=${scenarioMaxTicks} seed="${options.seed}"`
  )
  console.log(`Bank size: ${scenarioBank.length}`)
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

  // Compute scenario-derived context for corrected metrics
  const possibleDeaths = selected.reduce(
    (s, sc) => s + (sc.player.lives ?? 3),
    0
  )
  const MAX_SPEED = Math.PI / 10 // rad/s
  const BUCKET_DIAMETER = 0.31 // radians (icosahedral sub1)
  const scenarioDuration = (scenarioMaxTicks * options.dtMs) / 1000 // seconds
  const maxCellsPerScenario = Math.ceil(
    (MAX_SPEED * scenarioDuration) / BUCKET_DIAMETER
  )
  const cellBudget = scenariosPerOrganism * maxCellsPerScenario

  const ctx = {
    numScenarios: scenariosPerOrganism,
    possibleDeaths,
    cellBudget,
    maxCellsPerScenario,
  }

  console.log(`  Scenario context:`)
  console.log(`    possibleDeaths = sum(startingLives) = ${possibleDeaths}`)
  console.log(
    `    scenarioDuration = ${scenarioMaxTicks} × ${options.dtMs}ms = ${(scenarioDuration).toFixed(2)}s`
  )
  console.log(
    `    maxCellsPerScenario = maxSpeed × duration / bucketDiam = ${maxCellsPerScenario}`
  )
  console.log(
    `    cellBudget = ${scenariosPerOrganism} × ${maxCellsPerScenario} = ${cellBudget} (earned cells at full speed)`
  )
  console.log()

  // Lives distribution across scenario bank
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

    const allMetrics = []
    const scenarioConfig = { ...config.simulation, maxTicks: scenarioMaxTicks }
    for (const scenario of selected) {
      allMetrics.push(
        simulateScenario(
          agent,
          scenario,
          scenarioConfig,
          options.seed,
          executor
        )
      )
    }

    const agg = aggregateMetrics(allMetrics)

    // Raw metrics summary
    console.log(`\n── Raw Metrics (${allMetrics.length} scenarios) ──`)
    console.log(
      `  score=${agg.score}  rocksDestroyed=${agg.rocksDestroyed}  deaths=${agg.deaths}  accuracy=${fmtNum(agg.accuracy)}`
    )
    console.log(
      `  shotsFired=${agg.shotsFired}  shotsHit=${agg.shotsHit}  livesRemaining=${agg.livesRemaining} (min agg)`
    )
    console.log(
      `  aliveFrames=${agg.aliveFrames}  thrust=${agg.thrustFrames}  fire=${agg.fireFrames}  left=${agg.leftFrames}  right=${agg.rightFrames}`
    )
    console.log(
      `  uniqueCells=${agg.uniqueCellsVisited}  rocksInSOI=${agg.framesWithRocksInSOI}`
    )

    // Corrected metrics
    const earnedCells = Math.max(
      agg.uniqueCellsVisited - scenariosPerOrganism - agg.deaths,
      0
    )
    const survivalRatio =
      possibleDeaths > 0 ? 1 - agg.deaths / possibleDeaths : 1
    console.log(`\n── Corrected Metrics ──`)
    console.log(
      `  survivalRatio:  1 - ${agg.deaths}/${possibleDeaths} = ${fmtNum(survivalRatio)}  (deaths/possibleDeaths)`
    )
    console.log(
      `  earnedCells:    ${agg.uniqueCellsVisited} - ${scenariosPerOrganism} scenarios - ${agg.deaths} deaths = ${earnedCells}`
    )
    console.log(
      `  cellsNorm:      ${earnedCells}/${cellBudget} = ${fmtNum(earnedCells / cellBudget)}  (earned/budget)`
    )

    // Compute all scoring methods
    const gc = config.gateConfig
    const scores = [
      scoreCurrent(agg, gc, ctx),
      scoreAltA(agg, gc, ctx),
      scoreAltB(agg, gc, ctx),
      scoreAltC(agg, gc, ctx),
      scoreAltD(agg, gc, ctx),
      scoreAltE(agg, gc, ctx),
    ]

    console.log(`\n── Scoring Methods ──`)
    for (const s of scores) {
      console.log(
        `  ${pad(s.label, 24)} fitness=${fmtNum(s.fitness, 4)}  | ${s.detail}`
      )
    }

    agentData.push({ name, agg, allMetrics, scores })
    console.log()
  }

  // ═══════════════════════════════════════════════════════════════════
  if (agentData.length >= 2) {
    const dn = agentData.find((r) => r.name === 'doNothing')
    const rn = agentData.find((r) => r.name === 'random')

    if (dn && rn) {
      console.log(`${'═'.repeat(72)}`)
      console.log(`  SCORING METHOD COMPARISON`)
      console.log(`${'═'.repeat(72)}`)
      console.log()
      console.log(
        `  ${pad('Method', 24)} ${pad('doNothing', 10)} ${pad('random', 10)} ${pad('gap', 10)} ${pad('ratio', 8)} signal`
      )
      console.log(`  ${'─'.repeat(66)}`)

      for (let i = 0; i < dn.scores.length; i++) {
        const ds = dn.scores[i]
        const rs = rn.scores[i]
        const gap = rs.fitness - ds.fitness
        const ratio =
          ds.fitness > 1e-6 ? (rs.fitness / ds.fitness).toFixed(1) + 'x' : '∞'
        const signal =
          gap < 0.05
            ? '❌ no gap'
            : gap < 0.15
              ? '⚠️  marginal'
              : gap < 0.3
                ? '✓ good'
                : '✓✓ strong'
        console.log(
          `  ${pad(ds.label, 24)} ${pad(fmtNum(ds.fitness, 4), 10)} ${pad(fmtNum(rs.fitness, 4), 10)} ${pad(fmtNum(gap, 4), 10)} ${pad(ratio, 8)} ${signal}`
        )
      }

      // Detailed breakdowns
      console.log()
      console.log(`${'═'.repeat(72)}`)
      console.log(`  COMPONENT BREAKDOWNS`)
      console.log(`${'═'.repeat(72)}`)

      for (let i = 0; i < dn.scores.length; i++) {
        const ds = dn.scores[i]
        const rs = rn.scores[i]
        console.log(`\n  ── ${ds.label} ──`)
        console.log(`    doNothing: ${ds.detail}`)
        console.log(`    random:    ${rs.detail}`)

        const allKeys = new Set([
          ...Object.keys(ds.components),
          ...Object.keys(rs.components),
        ])
        if (allKeys.size > 0) {
          for (const key of allKeys) {
            const dv = ds.components[key] ?? 0
            const rv = rs.components[key] ?? 0
            const delta = rv - dv
            const tag =
              Math.abs(delta) < 0.02
                ? ' ← NO SIGNAL'
                : Math.abs(delta) < 0.1
                  ? ' ← weak'
                  : ''
            console.log(
              `      ${pad(key, 20)} ${fmtNum(dv)} → ${fmtNum(rv)}  (Δ=${delta >= 0 ? '+' : ''}${fmtNum(delta)})${tag}`
            )
          }
        }
      }

      // Analysis
      console.log()
      console.log(`${'═'.repeat(72)}`)
      console.log(`  ANALYSIS`)
      console.log(`${'═'.repeat(72)}`)

      console.log(`\n  Corrected raw signals (doNothing → random):`)
      console.log(`    score:           ${dn.agg.score} → ${rn.agg.score}`)
      console.log(
        `    rocksDestroyed:  ${dn.agg.rocksDestroyed} → ${rn.agg.rocksDestroyed}`
      )
      console.log(
        `    accuracy:        ${fmtNum(dn.agg.accuracy)} → ${fmtNum(rn.agg.accuracy)}`
      )
      const dnSurv = possibleDeaths > 0 ? 1 - dn.agg.deaths / possibleDeaths : 1
      const rnSurv = possibleDeaths > 0 ? 1 - rn.agg.deaths / possibleDeaths : 1
      console.log(
        `    survivalRatio:   ${fmtNum(dnSurv)} → ${fmtNum(rnSurv)}  (1 - deaths/${possibleDeaths})`
      )
      const dnEarned = Math.max(
        dn.agg.uniqueCellsVisited - scenariosPerOrganism - dn.agg.deaths,
        0
      )
      const rnEarned = Math.max(
        rn.agg.uniqueCellsVisited - scenariosPerOrganism - rn.agg.deaths,
        0
      )
      console.log(
        `    earnedCells:     ${dnEarned} → ${rnEarned}  (raw: ${dn.agg.uniqueCellsVisited} → ${rn.agg.uniqueCellsVisited})`
      )

      console.log(`\n  Current method issues:`)
      const issues = []
      if (dn.agg.livesRemaining === 0 && rn.agg.livesRemaining === 0)
        issues.push(
          'livesRemaining always 0 (min aggregation) → 20% dead quality weight'
        )
      if (dn.agg.uniqueCellsVisited >= config.gateConfig.cellsCoverageTarget)
        issues.push(
          `cellsVisited saturated at ${dn.agg.uniqueCellsVisited} (target=${config.gateConfig.cellsCoverageTarget}) — includes ${scenariosPerOrganism} free starting cells`
        )
      if (rn.agg.accuracy > 0.01)
        issues.push(
          `accuracy (${fmtNum(rn.agg.accuracy)}) unused in current quality — wasted gradient`
        )
      issues.push(`engagement gate identical for both → dead multiplier`)
      issues.push(`survival gate clamped to floor for both → dead multiplier`)
      for (const issue of issues) {
        console.log(`    - ${issue}`)
      }

      console.log(`\n  What a skilled NEAT agent needs to beat random:`)
      console.log(
        `    - Higher accuracy: random=${pct(rn.agg.accuracy)}, skilled target=30-50%`
      )
      console.log(
        `    - More rocks: random=${rn.agg.rocksDestroyed}, need aim + seek`
      )
      console.log(
        `    - Fewer deaths: random=${rn.agg.deaths}/${possibleDeaths}, skilled should be 0-2`
      )
      console.log(
        `    - Diverse actions: random already maxes action gate — this is table stakes`
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
