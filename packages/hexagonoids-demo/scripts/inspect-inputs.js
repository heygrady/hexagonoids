/**
 * Diagnostic script: inspect NEAT agent inputs across scenario gauntlet.
 *
 * Compares multiple configurations (ray counts, vision ranges) side by side,
 * running 100 scenarios per config with a parameterized inline lidar encoder.
 *
 * Usage:
 *   node packages/hexagonoids-demo/scripts/inspect-inputs.js [options]
 *
 * Options:
 *   --rayCount <8|16|32|all>     default: 'all' (tests 8, 16, 32)
 *   --visionMode <short|long|both>  default: 'both'
 *   --scenariosPerRun <n>        default: 100
 *   --scenarioMaxTicks <n>       default: 60
 *   --seed <seed>                default: 'inspect-inputs-001'
 *   --agent <random|doNothing>   default: 'random'
 *   --dtMs <n>                   default: 33
 *   --verbose                    print per-ray details and sample frames
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')

// ── Helpers ─────────────────────────────────────────────────────────────────

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function wrapAngle(value) {
  let a = value
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

// ── CLI argument parsing ────────────────────────────────────────────────────

function parseArgs(argv) {
  const options = {
    rayCount: 'all',
    visionMode: 'both',
    scenariosPerRun: 100,
    scenarioMaxTicks: 60,
    seed: 'inspect-inputs-001',
    agent: 'random',
    dtMs: 33,
    verbose: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--rayCount' && argv[i + 1]) options.rayCount = argv[++i]
    else if (arg === '--visionMode' && argv[i + 1])
      options.visionMode = argv[++i]
    else if (arg === '--scenariosPerRun' && argv[i + 1])
      options.scenariosPerRun = Number(argv[++i])
    else if (arg === '--scenarioMaxTicks' && argv[i + 1])
      options.scenarioMaxTicks = Number(argv[++i])
    else if (arg === '--seed' && argv[i + 1]) options.seed = argv[++i]
    else if (arg === '--agent' && argv[i + 1]) options.agent = argv[++i]
    else if (arg === '--dtMs' && argv[i + 1]) options.dtMs = Number(argv[++i])
    else if (arg === '--verbose') options.verbose = true
  }
  return options
}

// ── Inline parameterized lidar encoder ──────────────────────────────────────

const DEG_TO_RAD = Math.PI / 180
const TWO_PI = Math.PI * 2
const CLOSING_EPSILON = 1e-9

/**
 * Encode game state into a fixed-size vector with parameterized ray count
 * and vision arc. Reuses ship global features from the built package encoder
 * but reimplements the lidar scan with configurable parameters.
 */
function encodeWithConfig(
  state,
  playerId,
  prevDistances,
  dtMs,
  rayCount,
  maxVisionArc,
  engine
) {
  const GLOBAL_FEATURES = 5
  const FEATURES_PER_RAY = 4
  const inputCount = GLOBAL_FEATURES + rayCount * FEATURES_PER_RAY

  const player = state.players.get(playerId)
  const ship =
    player?.shipId != null ? state.ships.get(player.shipId) : undefined

  const inputs = new Array(inputCount).fill(0)

  if (ship == null || !ship.alive) {
    return inputs
  }

  // Ship global features (same as production encoder)
  const angVel = ship.angularVelocity
  const speed = Math.sqrt(
    angVel.x * angVel.x + angVel.y * angVel.y + angVel.z * angVel.z
  )
  const MAX_SPEED = engine.MAX_SPEED
  const TURN_RATE = engine.TURN_RATE
  const FIRE_COOLDOWN = engine.FIRE_COOLDOWN
  const RADIUS = engine.RADIUS
  const PLAYER_STARTING_LIVES = engine.PLAYER_STARTING_LIVES
  const MAX_CLOSING_SPEED = MAX_SPEED + engine.ROCK_LARGE_SPEED

  inputs[0] = clamp(speed / MAX_SPEED, 0, 1)
  // Simplified heading drift — use 1/0 for forward/lateral since we don't
  // have the full quaternion math here. Ship global features are just context;
  // the important thing for this diagnostic is LIDAR channel coverage.
  inputs[1] = speed > 0.00001 ? 1 : 0 // forward drift placeholder
  inputs[2] = 0 // lateral drift placeholder
  inputs[3] = clamp(speed / TURN_RATE, 0, 1)
  inputs[4] = clamp(engine.elapsed(state, ship.firedAt) / FIRE_COOLDOWN, 0, 1)

  // ── Lidar scan ──────────────────────────────────────────────────────

  const rayStep = TWO_PI / rayCount
  const rayAngles = new Array(rayCount)
  for (let i = 0; i < rayCount; i++) {
    rayAngles[i] = (i / rayCount) * TWO_PI - Math.PI
  }

  // Ship geo context
  const shipLatRad = ship.lat * DEG_TO_RAD
  const shipLngRad = ship.lng * DEG_TO_RAD
  const shipSinLat = Math.sin(shipLatRad)
  const shipCosLat = Math.cos(shipLatRad)
  const shipBearing = yawToBearing(ship.yaw)
  const maxVisionAngle = maxVisionArc / RADIUS
  const cosLatSafe = Math.max(Math.abs(shipCosLat), 0.12)
  const maxLngDelta = Math.min(Math.PI, maxVisionAngle / cosLatSafe + 0.05)

  const invDtSeconds = dtMs > 0 ? 1000 / dtMs : 0

  // Initialize lidar (distanceNorm=1 means "nothing detected")
  const lidar = new Array(rayCount)
  for (let i = 0; i < rayCount; i++) {
    lidar[i] = { distanceNorm: 1, closingSpeed: 0, isRock: 0, isBullet: 0 }
  }

  function rayIndexFromRelativeBearing(relative) {
    const normalized = (relative + Math.PI) / TWO_PI
    return Math.floor(normalized * rayCount) % rayCount
  }

  function wrapRelative(angle) {
    let rel = angle
    while (rel > Math.PI) rel -= TWO_PI
    while (rel < -Math.PI) rel += TWO_PI
    return rel
  }

  function updateRayHit(
    relBearing,
    arcDist,
    entityRadius,
    closingSpeed,
    isRock
  ) {
    if (arcDist > maxVisionArc) return

    const centerRayIndex = rayIndexFromRelativeBearing(relBearing)
    const centerRayAngle = rayAngles[centerRayIndex] ?? 0
    const baseDelta = wrapAngle(relBearing - centerRayAngle)
    const distanceNorm = clamp(arcDist / maxVisionArc, 0, 1)
    const closingSpeedNorm = clamp(closingSpeed / MAX_CLOSING_SPEED, -1, 1)
    const radiusArc = clamp(entityRadius / RADIUS, 0.001, 0.35)

    for (let offset = -2; offset <= 2; offset++) {
      const delta = Math.abs(baseDelta - offset * rayStep)
      if (delta > radiusArc) continue

      const idx = (centerRayIndex + offset + rayCount) % rayCount
      const current = lidar[idx]
      if (current == null) continue
      if (distanceNorm >= current.distanceNorm) continue

      current.distanceNorm = distanceNorm
      current.closingSpeed = closingSpeedNorm
      current.isRock = isRock ? 1 : 0
      current.isBullet = isRock ? 0 : 1
    }
  }

  function rockRadiusBySize(size) {
    return size === 2 ? 0.26 : size === 1 ? 0.13 : 0.07
  }

  // Scan rocks
  for (const rock of state.rocks.values()) {
    const phi = rock.lat * DEG_TO_RAD
    const lambda = rock.lng * DEG_TO_RAD
    const cosPhi = Math.cos(phi)

    const dLat = phi - shipLatRad
    const dLng = wrapAngle(lambda - shipLngRad)
    const sinHalfLat = Math.sin(dLat * 0.5)
    const sinHalfLng = Math.sin(dLng * 0.5)
    const a =
      sinHalfLat * sinHalfLat + shipCosLat * cosPhi * sinHalfLng * sinHalfLng
    const dist = RADIUS * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
    if (dist > maxVisionArc) continue

    const y = Math.sin(dLng) * cosPhi
    const x = shipCosLat * Math.sin(phi) - shipSinLat * cosPhi * Math.cos(dLng)
    const relativeBearing = wrapRelative(Math.atan2(y, x) - shipBearing)

    const key = `rock:${rock.id}`
    const prev = prevDistances.get(key)
    const closing =
      prev != null && invDtSeconds > CLOSING_EPSILON
        ? (prev - dist) * invDtSeconds
        : 0

    updateRayHit(
      relativeBearing,
      dist,
      rockRadiusBySize(rock.size),
      closing,
      true
    )
  }

  // Scan bullets
  for (const bullet of state.bullets.values()) {
    const dLatDeg = Math.abs((bullet.lat - ship.lat) * DEG_TO_RAD)
    if (dLatDeg > maxVisionAngle) continue
    const dLngDeg = Math.abs(wrapAngle((bullet.lng - ship.lng) * DEG_TO_RAD))
    if (dLngDeg > maxLngDelta) continue

    const phi2 = bullet.lat * DEG_TO_RAD
    const cosPhi2 = Math.cos(phi2)
    const dLat = phi2 - shipLatRad
    const dLng = (bullet.lng - ship.lng) * DEG_TO_RAD

    const sinHalfLat = Math.sin(dLat * 0.5)
    const sinHalfLng = Math.sin(dLng * 0.5)
    const a =
      sinHalfLat * sinHalfLat + shipCosLat * cosPhi2 * sinHalfLng * sinHalfLng
    const dist = RADIUS * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
    if (dist > maxVisionArc) continue

    const y = Math.sin(dLng) * cosPhi2
    const x =
      shipCosLat * Math.sin(phi2) - shipSinLat * cosPhi2 * Math.cos(dLng)
    const relativeBearing = wrapRelative(Math.atan2(y, x) - shipBearing)

    const key = `bullet:${bullet.id}`
    const prev = prevDistances.get(key)
    const closing =
      prev != null && invDtSeconds > CLOSING_EPSILON
        ? (prev - dist) * invDtSeconds
        : 0

    updateRayHit(relativeBearing, dist, 0.03, closing, false)
  }

  // Encode lidar into flat vector
  for (let i = 0; i < rayCount; i++) {
    const hit = lidar[i]
    const base = GLOBAL_FEATURES + i * FEATURES_PER_RAY
    inputs[base] = 1 - hit.distanceNorm
    inputs[base + 1] = hit.closingSpeed
    inputs[base + 2] = hit.isRock
    inputs[base + 3] = hit.isBullet
  }

  return inputs
}

function yawToBearing(yaw) {
  return -yaw
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const options = parseArgs(process.argv.slice(2))

  // Import dependencies
  const engine = await import('@heygrady/hexagonoids-engine')
  const env = await import('@heygrady/hexagonoids-environment')
  const { createRNG } = await import('@neat-evolution/utils')

  const { restoreSnapshot, doNothingAgent, randomAgent } = env
  const {
    step,
    greatCircleDistance,
    RADIUS,
    ROCK_SPAWN_BORDER_HALF_HEIGHT,
    ROCK_SPAWN_BORDER_HALF_WIDTH,
  } = engine

  const PLAYER_ID = 'player-1'
  const GLOBAL_FEATURES = 5
  const FEATURES_PER_RAY = 4

  // ── Build configuration matrix ──────────────────────────────────────

  const shortSideArc = ROCK_SPAWN_BORDER_HALF_HEIGHT * DEG_TO_RAD * RADIUS
  const longSideArc = ROCK_SPAWN_BORDER_HALF_WIDTH * DEG_TO_RAD * RADIUS

  const visionModes = []
  if (options.visionMode === 'short' || options.visionMode === 'both') {
    visionModes.push({ name: 'short', arc: shortSideArc })
  }
  if (options.visionMode === 'long' || options.visionMode === 'both') {
    visionModes.push({ name: 'long', arc: longSideArc })
  }

  const rayCounts = []
  if (options.rayCount === 'all') {
    rayCounts.push(8, 16, 32)
  } else {
    rayCounts.push(Number(options.rayCount))
  }

  const configs = []
  for (const rc of rayCounts) {
    for (const vm of visionModes) {
      configs.push({
        label: `${rc}r-${vm.name}`,
        rayCount: rc,
        visionArc: vm.arc,
        inputCount: GLOBAL_FEATURES + rc * FEATURES_PER_RAY,
      })
    }
  }

  // ── Load scenarios ──────────────────────────────────────────────────

  const scenariosPath = resolve(packageRoot, 'src/data/scenarios.json')
  const scenarioBank = JSON.parse(readFileSync(scenariosPath, 'utf-8'))

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

  console.log(
    `\n=== Input Inspection ===\n` +
      `seed="${options.seed}" agent=${options.agent} ` +
      `scenarios=${selected.length}/${scenarioBank.length} ` +
      `maxTicks=${options.scenarioMaxTicks} dtMs=${options.dtMs}\n` +
      `shortSideArc=${shortSideArc.toFixed(4)} longSideArc=${longSideArc.toFixed(4)}\n` +
      `Configs: ${configs.map((c) => c.label).join(', ')}\n`
  )

  // Select agent
  const baseAgent = options.agent === 'doNothing' ? doNothingAgent : randomAgent

  // ── Run scenario gauntlet per config ────────────────────────────────

  const configResults = []

  for (const config of configs) {
    const { rayCount, visionArc, inputCount, label } = config
    const allInputs = [] // all frames across all scenarios
    let totalFrames = 0

    for (const scenario of selected) {
      const { state, rng } = restoreSnapshot(scenario, options.seed)
      const context = { rng, memory: {}, executor: undefined }
      const prevDistances = new Map()

      for (let tick = 0; tick < options.scenarioMaxTicks; tick++) {
        if (state.endedAt != null) break

        const player = state.players.get(PLAYER_ID)
        const ship =
          player?.shipId != null ? state.ships.get(player.shipId) : undefined

        // Encode with parameterized config
        const inputs = encodeWithConfig(
          state,
          PLAYER_ID,
          prevDistances,
          options.dtMs,
          rayCount,
          visionArc,
          engine
        )
        allInputs.push(inputs)
        totalFrames++

        // Get agent action
        const action = baseAgent(state, PLAYER_ID, context)

        // Update prevDistances
        if (ship?.alive) {
          for (const rock of state.rocks.values()) {
            prevDistances.set(
              `rock:${rock.id}`,
              greatCircleDistance(
                ship.lat,
                ship.lng,
                rock.lat,
                rock.lng,
                RADIUS
              )
            )
          }
          for (const bullet of state.bullets.values()) {
            prevDistances.set(
              `bullet:${bullet.id}`,
              greatCircleDistance(
                ship.lat,
                ship.lng,
                bullet.lat,
                bullet.lng,
                RADIUS
              )
            )
          }
        }

        // Step
        const stepInputs = { [PLAYER_ID]: action }
        step(state, stepInputs, options.dtMs, rng)
      }
    }

    // ── Per-channel statistics ─────────────────────────────────────

    const stats = new Array(inputCount)
    for (let c = 0; c < inputCount; c++) {
      let min = Infinity
      let max = -Infinity
      let sum = 0
      let nonzero = 0
      for (let f = 0; f < totalFrames; f++) {
        const v = allInputs[f][c]
        if (v < min) min = v
        if (v > max) max = v
        sum += v
        if (Math.abs(v) > 1e-9) nonzero++
      }
      stats[c] = { min, max, mean: sum / totalFrames, nonzero }
    }

    // LIDAR aggregate by feature type
    const lidarAgg = []
    const lidarFeatureNames = [
      'proximity',
      'closingSpeed',
      'isRock',
      'isBullet',
    ]
    for (let feat = 0; feat < FEATURES_PER_RAY; feat++) {
      let gMin = Infinity
      let gMax = -Infinity
      let gSum = 0
      let gNonzero = 0
      let totalSamples = 0
      for (let r = 0; r < rayCount; r++) {
        const idx = GLOBAL_FEATURES + r * FEATURES_PER_RAY + feat
        const s = stats[idx]
        if (s.min < gMin) gMin = s.min
        if (s.max > gMax) gMax = s.max
        gSum += s.mean * totalFrames
        gNonzero += s.nonzero
        totalSamples += totalFrames
      }
      lidarAgg.push({
        name: lidarFeatureNames[feat],
        min: gMin,
        max: gMax,
        mean: gSum / totalSamples,
        nonzeroPct: (gNonzero / totalSamples) * 100,
      })
    }

    // All-zero LIDAR frame analysis
    let allZeroLidarFrames = 0
    let allZeroStreakMax = 0
    let currentStreak = 0

    // Per-ray activation
    const rayActivations = new Array(rayCount).fill(0)

    for (let f = 0; f < totalFrames; f++) {
      const inputs = allInputs[f]
      let allZero = true
      for (let r = 0; r < rayCount; r++) {
        const base = GLOBAL_FEATURES + r * FEATURES_PER_RAY
        if (inputs[base] > 1e-9) {
          allZero = false
          rayActivations[r]++
        }
      }
      if (allZero) {
        allZeroLidarFrames++
        currentStreak++
      } else {
        if (currentStreak > allZeroStreakMax) allZeroStreakMax = currentStreak
        currentStreak = 0
      }
    }
    if (currentStreak > allZeroStreakMax) allZeroStreakMax = currentStreak

    const zeroLidarPct = (allZeroLidarFrames / totalFrames) * 100
    const meanActiveRays =
      rayActivations.reduce((s, v) => s + v, 0) / totalFrames
    const coveragePct = (meanActiveRays / rayCount) * 100
    const saturationPct = 100 - zeroLidarPct

    configResults.push({
      label,
      inputCount,
      rayCount,
      totalFrames,
      zeroLidarPct,
      meanActiveRays,
      coveragePct,
      saturationPct,
      allZeroStreakMax,
      stats,
      lidarAgg,
      rayActivations,
      allInputs: options.verbose ? allInputs : null,
    })
  }

  // ── Comparison table ────────────────────────────────────────────────

  console.log('── Comparison ──')
  console.log(
    'Config'.padEnd(18) +
      'Inputs'.padStart(8) +
      'ZeroLidar%'.padStart(12) +
      'MeanActive'.padStart(12) +
      'Coverage%'.padStart(11) +
      'Saturation%'.padStart(13) +
      'MaxStreak'.padStart(11)
  )
  for (const r of configResults) {
    console.log(
      r.label.padEnd(18) +
        String(r.inputCount).padStart(8) +
        `${r.zeroLidarPct.toFixed(1)}%`.padStart(12) +
        r.meanActiveRays.toFixed(1).padStart(12) +
        `${r.coveragePct.toFixed(1)}%`.padStart(11) +
        `${r.saturationPct.toFixed(1)}%`.padStart(13) +
        String(r.allZeroStreakMax).padStart(11)
    )
  }

  // ── Per-config details ──────────────────────────────────────────────

  for (const r of configResults) {
    console.log(
      `\n══ ${r.label} (${r.inputCount} inputs, ${r.totalFrames} frames) ══`
    )

    // LIDAR aggregate
    console.log('  LIDAR Aggregate:')
    for (const agg of r.lidarAgg) {
      console.log(
        `    ${agg.name.padEnd(16)}` +
          `min=${agg.min.toFixed(4).padStart(8)} ` +
          `max=${agg.max.toFixed(4).padStart(8)} ` +
          `mean=${agg.mean.toFixed(4).padStart(8)} ` +
          `nonzero=${agg.nonzeroPct.toFixed(1)}%`
      )
    }

    // Per-ray activation bar chart (always shown, compact)
    if (options.verbose) {
      console.log('  Per-Ray Activation:')
      for (let ray = 0; ray < r.rayCount; ray++) {
        const pct = (r.rayActivations[ray] / r.totalFrames) * 100
        const bar = '#'.repeat(Math.round(pct / 2))
        const angleDeg = ((ray / r.rayCount) * 360 - 180).toFixed(0)
        console.log(
          `    ray${String(ray).padStart(2)} (${angleDeg.padStart(4)}°): ${pct.toFixed(1).padStart(5)}% ${bar}`
        )
      }
    }

    // Sample frames (verbose only)
    if (options.verbose && r.allInputs != null) {
      console.log('  Sample Frames (first 5 with LIDAR activity):')
      let shown = 0
      for (let f = 0; f < r.totalFrames && shown < 5; f++) {
        const inputs = r.allInputs[f]
        let hasActivity = false
        for (let c = GLOBAL_FEATURES; c < r.inputCount; c++) {
          if (Math.abs(inputs[c]) > 1e-9) {
            hasActivity = true
            break
          }
        }
        if (!hasActivity) continue
        shown++

        console.log(`    Frame ${f}:`)
        console.log(
          `      globals: speed=${inputs[0].toFixed(3)} fwdDrift=${inputs[1].toFixed(3)} latDrift=${inputs[2].toFixed(3)} angVel=${inputs[3].toFixed(3)} cooldown=${inputs[4].toFixed(3)}`
        )
        const activeRays = []
        for (let ray = 0; ray < r.rayCount; ray++) {
          const base = GLOBAL_FEATURES + ray * FEATURES_PER_RAY
          if (inputs[base] > 1e-9) {
            activeRays.push({
              ray,
              proximity: inputs[base].toFixed(3),
              closingSpeed: inputs[base + 1].toFixed(3),
              isRock: inputs[base + 2],
              isBullet: inputs[base + 3],
            })
          }
        }
        console.log(`      active rays (${activeRays.length}/${r.rayCount}):`)
        for (const ar of activeRays) {
          console.log(
            `        ray${ar.ray}: prox=${ar.proximity} closing=${ar.closingSpeed} rock=${ar.isRock} bullet=${ar.isBullet}`
          )
        }
      }
    }
  }

  console.log('\n=== Done ===\n')
}

main().catch((error) => {
  console.error('inspect-inputs failed:', error)
  process.exit(1)
})
