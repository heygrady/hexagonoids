/**
 * Diagnostic: inspect reward-fitness correlation during training.
 *
 * Runs a full training loop (25 population, 15 iterations) with a stats
 * recorder that captures GauntletBreakdown per organism. After each
 * generation, extracts fitness and totalReward for each organism and
 * computes Pearson correlation to verify reward-fitness alignment.
 */
import {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  DEFAULT_REWARD_CONFIG,
  type FitnessWeights,
  type GauntletBreakdown,
  METRIC_GAUNTLET_BREAKDOWN,
  type RewardConfig,
} from '@heygrady/hexagonoids-environment'
import { createMemoryRecorder } from '@neat-evolution/stats'
import { defaultProfile } from '../profiles/index.js'
import { train } from '../training/train.js'

// ── Types ──

export interface InspectRewardsOptions {
  seed: string
  method: string
  rewardConfig: RewardConfig
  populationSize: number
  iterations: number
}

export function defaultInspectRewardsOptions(): InspectRewardsOptions {
  const pc = (defaultProfile.config ?? {}) as Record<string, unknown>

  return {
    seed: 'inspect-rewards-001',
    method: (pc.method as string | undefined) ?? 'HyperNEAT',
    rewardConfig: { ...DEFAULT_REWARD_CONFIG },
    populationSize: 25,
    iterations: 15,
  }
}

// ── Correlation math ──

function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0

  let sumX = 0
  let sumY = 0
  for (let i = 0; i < n; i++) {
    sumX += xs[i] as number
    sumY += ys[i] as number
  }
  const meanX = sumX / n
  const meanY = sumY / n

  let cov = 0
  let varX = 0
  let varY = 0
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - meanX
    const dy = (ys[i] as number) - meanY
    cov += dx * dy
    varX += dx * dx
    varY += dy * dy
  }

  const denom = Math.sqrt(varX * varY)
  return denom < 1e-12 ? 0 : cov / denom
}

function fmtNum(n: number, decimals = 4): string {
  return n.toFixed(decimals)
}

// ── Main ──

export async function runInspectRewards(
  options: InspectRewardsOptions
): Promise<void> {
  const pc = (defaultProfile.config ?? {}) as Record<string, unknown>
  const rewardConfig = options.rewardConfig

  console.log('\n=== Reward-Fitness Correlation ===')
  console.log(
    `Population: ${options.populationSize}  Iterations: ${options.iterations}  Seed: "${options.seed}"`
  )
  console.log(
    `Reward config: deathPenalty=${rewardConfig.deathPenalty} bulletAimReward=${rewardConfig.bulletAimReward} bulletMissDemerit=${rewardConfig.bulletMissDemerit}`
  )
  console.log()

  // Create stats recorder to capture per-organism GauntletBreakdown
  const recorder = createMemoryRecorder([METRIC_GAUNTLET_BREAKDOWN])

  // Track per-generation correlation data
  interface GenerationData {
    iteration: number
    speciesCount: number
    fitnesses: number[]
    rewards: number[]
    correlation: number
  }
  const generations: GenerationData[] = []

  await train({
    method: options.method as 'HyperNEAT',
    populationSize: options.populationSize,
    iterations: options.iterations,
    baseSeed: options.seed,
    logInterval: 0, // suppress default logging
    // scenarioMode inferred from scenarioWeight > 0
    scenariosPerOrganism:
      (pc.scenariosPerOrganism as number | undefined) ?? 128,
    scenarioMaxTicks: (pc.scenarioMaxTicks as number | undefined) ?? 64,
    maxTicks: (pc.maxTicks as number | undefined) ?? 2048,
    dtMs:
      (pc.dtMs as number | undefined) ??
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation.dtMs,
    curriculumCount: (pc.curriculumCount as number | undefined) ?? 48,
    scenarioWeight: (pc.scenarioWeight as number | undefined) ?? 0.3,
    fullGameWeight: (pc.fullGameWeight as number | undefined) ?? 0.6,
    curriculumWeight: (pc.curriculumWeight as number | undefined) ?? 0.1,
    fullGameSeedsPerOrganism:
      (pc.fullGameSeedsPerOrganism as number | undefined) ?? 2,
    fitnessWeights: pc.fitnessWeights as FitnessWeights | undefined,
    gateConfig: pc.gateConfig as Record<string, unknown> | undefined,
    earlyStopPatience: options.iterations + 1,
    secondsLimit: 0,
    // Reward config
    rlRewardRock: rewardConfig.rockReward,
    rlRewardDeath: rewardConfig.deathPenalty,
    rlRewardSurvival: rewardConfig.survivalReward,
    rlRewardBulletAim: rewardConfig.bulletAimReward,
    rlRewardBulletMissDemerit: rewardConfig.bulletMissDemerit,
    rlRewardThrust: rewardConfig.thrustReward,
    // Stats for breakdown capture
    stats: recorder,
    // Evolution hooks
    afterEvaluate: (population: unknown, iteration: number) => {
      // Extract breakdowns recorded this generation — take the latest batch
      const allBreakdowns = recorder.get<GauntletBreakdown>(
        METRIC_GAUNTLET_BREAKDOWN
      )
      const popSize = options.populationSize
      const genBreakdowns = allBreakdowns.slice(
        Math.max(0, allBreakdowns.length - popSize)
      )

      // Cast population to access species count
      const pop = population as { species: { size: number } }
      const speciesCount = pop.species.size

      // Use breakdown's own fitness field — this is correctly paired with
      // totalReward since both come from the same per-organism evaluation.
      // Use pre-gated fitness (blendedFitnessRaw) to see true performance
      // without behavioral gate penalties.
      const fitGated = genBreakdowns.map((b) => b.fitness)
      const fitRaw = genBreakdowns.map((b) => b.blendedFitnessRaw)
      const rewSlice = genBreakdowns.map((b) => b.totalReward)
      const n = fitGated.length
      const corrGated = pearsonCorrelation(fitGated, rewSlice)
      const corrRaw = pearsonCorrelation(fitRaw, rewSlice)

      const genData: GenerationData = {
        iteration,
        speciesCount,
        fitnesses: fitGated,
        rewards: rewSlice,
        correlation: corrGated,
      }
      generations.push(genData)

      // Find best by each metric
      let bestFitIdx = 0
      let bestRawIdx = 0
      let bestRewIdx = 0
      for (let i = 1; i < n; i++) {
        if ((fitGated[i] as number) > (fitGated[bestFitIdx] as number))
          bestFitIdx = i
        if ((fitRaw[i] as number) > (fitRaw[bestRawIdx] as number))
          bestRawIdx = i
        if ((rewSlice[i] as number) > (rewSlice[bestRewIdx] as number))
          bestRewIdx = i
      }

      const match =
        bestFitIdx === bestRewIdx
          ? 'FIT=REW'
          : bestRawIdx === bestRewIdx
            ? 'RAW=REW'
            : 'DIFF'

      console.log(
        `Gen ${String(iteration).padStart(2)}: species=${String(speciesCount).padStart(2)}  ` +
          `bestFit=${fmtNum(fitGated[bestFitIdx] as number, 3)}  ` +
          `bestRaw=${fmtNum(fitRaw[bestRawIdx] as number, 3)}  ` +
          `bestRew=${fmtNum(rewSlice[bestRewIdx] as number, 0)}(fit=${fmtNum(fitGated[bestRewIdx] as number, 3)})  ` +
          `${match}  rGated=${fmtNum(corrGated, 2)} rRaw=${fmtNum(corrRaw, 2)}`
      )
    },
  })

  // Summary
  console.log()
  console.log('=== Correlation Summary ===')
  if (generations.length > 0) {
    const correlations = generations.map((g) => g.correlation)
    const meanCorr =
      correlations.reduce((a, b) => a + b, 0) / correlations.length
    const minCorr = Math.min(...correlations)
    const maxCorr = Math.max(...correlations)
    console.log(
      `  Mean r=${fmtNum(meanCorr, 3)}  Min r=${fmtNum(minCorr, 3)}  Max r=${fmtNum(maxCorr, 3)}`
    )
    console.log(`  Generations: ${generations.length}`)
  }
  console.log()
}
