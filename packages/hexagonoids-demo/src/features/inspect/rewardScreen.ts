import {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  METRIC_GAUNTLET_BREAKDOWN,
  SHAPING_TERM_SEMANTICS,
  type GauntletBreakdown,
  type RewardConfig,
} from '@heygrady/hexagonoids-environment'
import { createMemoryRecorder } from '@neat-evolution/stats'
import type { TrainOptions } from '../training/train.js'
import { train } from '../training/train.js'
import { pearsonCorrelation } from './rewardAlignment.js'

type ScreenRlMode = 'a2c' | 'ppo'
type ActiveRlMode = NonNullable<TrainOptions['rlMode']>

export interface RewardScreenOptions {
  seed: string
  method: string
  inspectIterations: number
  inspectPopulationSize: number
  rlIterations: number
  rlPopulationSize: number
  profileConfig?: Partial<TrainOptions> | undefined
  baseRewardConfig: RewardConfig
}

interface CandidateSpec {
  label: string
  rewardConfig: RewardConfig
}

export interface RewardValidationOptions {
  seed: string
  method: string
  iterations: number
  populationSize: number
  seeds: string[]
  candidateLabels?: string[] | undefined
  profileConfig?: Partial<TrainOptions> | undefined
  baseRewardConfig: RewardConfig
}

interface GenerationStats {
  rawCorrelation: number
  fitCorrelation: number
  topRewardGate: number
  topRewardRaw: number
  topRewardFitness: number
}

interface TrainingSummary {
  bestFitness: number
  populationMean: number | null
  generations: GenerationStats[]
}

interface RlScreenSummary {
  bestDelta: number
  meanDelta: number | null
  meanRawCorrelation: number
  meanFitCorrelation: number
  topRewardGate: number
}

interface ScreenCandidateSummary {
  candidate: CandidateSpec
  inspect: ReturnType<typeof summarizeStats>
  a2c: RlScreenSummary
  ppo: RlScreenSummary
  score: number
}

const SHORTLIST_CANDIDATE_LIMIT = 2

function fmtNum(n: number, decimals = 3): string {
  return n.toFixed(decimals)
}

function clampRewardCoefficient(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

function rewardConfigSummary(config: RewardConfig): string {
  return [
    `kill=${config.rockReward}`,
    `death=${config.deathPenalty}`,
    `survival=${config.survivalReward}`,
    `engagement(${SHAPING_TERM_SEMANTICS.engagement})=${config.engagementReward}`,
    `progress(${SHAPING_TERM_SEMANTICS.progress})=${config.progressReward}`,
    `actionBand=${config.actionBandCost}`,
    `turnConflict=${config.turnConflictPenalty}`,
    `shotPenalty=${config.shotPenalty}`,
  ].join(' ')
}

export function buildRewardCandidates(
  baseRewardConfig: RewardConfig
): CandidateSpec[] {
  const carryForwardActionBand =
    baseRewardConfig.actionBandCost > 0 ? baseRewardConfig.actionBandCost : 0.006
  const engagementBase =
    baseRewardConfig.engagementReward !== 0
      ? baseRewardConfig.engagementReward
      : 0.01
  const progressBase =
    baseRewardConfig.progressReward !== 0 ? baseRewardConfig.progressReward : 0.05

  const current: CandidateSpec = {
    label: 'carry-forward-baseline',
    rewardConfig: {
      ...baseRewardConfig,
      actionBandCost: carryForwardActionBand,
    },
  }

  const accessFirst: CandidateSpec = {
    label: 'access-first',
    rewardConfig: {
      ...current.rewardConfig,
      engagementReward: clampRewardCoefficient(engagementBase * 2),
      progressReward: clampRewardCoefficient(progressBase * 0.7),
    },
  }

  const controlFirst: CandidateSpec = {
    label: 'control-first',
    rewardConfig: {
      ...current.rewardConfig,
      engagementReward: clampRewardCoefficient(engagementBase * 0.8),
      progressReward: clampRewardCoefficient(progressBase * 1.5),
    },
  }

  return [current, accessFirst, controlFirst]
}

function generationStats(breakdowns: GauntletBreakdown[]): GenerationStats {
  const totalRewards = breakdowns.map((b) => b.rewardBreakdown.total)
  const raws = breakdowns.map((b) => b.blendedFitnessRaw)
  const fits = breakdowns.map((b) => b.fitness)
  const topReward = [...breakdowns].sort(
    (a, b) => b.rewardBreakdown.total - a.rewardBreakdown.total
  )[0]
  if (topReward == null) {
    return {
      rawCorrelation: 0,
      fitCorrelation: 0,
      topRewardGate: 0,
      topRewardRaw: 0,
      topRewardFitness: 0,
    }
  }
  return {
    rawCorrelation: pearsonCorrelation(raws, totalRewards),
    fitCorrelation: pearsonCorrelation(fits, totalRewards),
    topRewardGate: topReward.gates.combined,
    topRewardRaw: topReward.blendedFitnessRaw,
    topRewardFitness: topReward.fitness,
  }
}

function summarizeStats(stats: GenerationStats[]): {
  meanRawCorrelation: number
  meanFitCorrelation: number
  finalTopRewardGate: number
  finalTopRewardRaw: number
  finalTopRewardFitness: number
} {
  if (stats.length === 0) {
    return {
      meanRawCorrelation: 0,
      meanFitCorrelation: 0,
      finalTopRewardGate: 0,
      finalTopRewardRaw: 0,
      finalTopRewardFitness: 0,
    }
  }
  const last = stats[stats.length - 1] as GenerationStats
  return {
    meanRawCorrelation:
      stats.reduce((sum, s) => sum + s.rawCorrelation, 0) / stats.length,
    meanFitCorrelation:
      stats.reduce((sum, s) => sum + s.fitCorrelation, 0) / stats.length,
    finalTopRewardGate: last.topRewardGate,
    finalTopRewardRaw: last.topRewardRaw,
    finalTopRewardFitness: last.topRewardFitness,
  }
}

async function runTrainingSummary({
  method,
  seed,
  rewardConfig,
  options,
  iterations,
  populationSize,
  rlMode,
}: {
  method: string
  seed: string
  rewardConfig: RewardConfig
  options: Partial<TrainOptions>
  iterations: number
  populationSize: number
  rlMode: ActiveRlMode
}): Promise<TrainingSummary> {
  const recorder = createMemoryRecorder([METRIC_GAUNTLET_BREAKDOWN])
  const generationSummaries: GenerationStats[] = []

  const result = await train({
    ...options,
    method: method as 'HyperNEAT',
    populationSize,
    iterations,
    baseSeed: seed,
    logInterval: 0,
    scenariosPerOrganism: options.scenariosPerOrganism ?? 128,
    scenarioMaxTicks: options.scenarioMaxTicks ?? 64,
    maxTicks: options.maxTicks ?? 2048,
    dtMs:
      options.dtMs ??
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation.dtMs,
    curriculumCount: options.curriculumCount ?? 48,
    scenarioWeight: options.scenarioWeight ?? 0.3,
    fullGameWeight: options.fullGameWeight ?? 0.4,
    curriculumWeight: options.curriculumWeight ?? 0.3,
    fullGameSeedsPerOrganism: options.fullGameSeedsPerOrganism ?? 2,
    fitnessWeights: options.fitnessWeights,
    gateConfig: options.gateConfig,
    behavioralGateConfig: options.behavioralGateConfig,
    earlyStopPatience: iterations + 1,
    secondsLimit: 0,
    rlMode,
    rlRewardRock: rewardConfig.rockReward,
    rlRewardDeath: rewardConfig.deathPenalty,
    rlRewardSurvival: rewardConfig.survivalReward,
    rlRewardEngagement: rewardConfig.engagementReward,
    rlRewardProgress: rewardConfig.progressReward,
    rlRewardActionBand: rewardConfig.actionBandCost,
    rlRewardTurnConflict: rewardConfig.turnConflictPenalty,
    rlRewardScoreScale: rewardConfig.scoreScale,
    rlRewardShotPenalty: rewardConfig.shotPenalty,
    rlRewardBulletAim: rewardConfig.bulletAimReward,
    rlRewardBulletAimOutOfRange: rewardConfig.bulletAimOutOfRangeScale,
    rlRewardBulletMissDemerit: rewardConfig.bulletMissDemerit,
    rlRewardThrust: rewardConfig.thrustReward,
    stats: recorder,
    afterEvaluate: () => {
      const allBreakdowns = recorder.get<GauntletBreakdown>(
        METRIC_GAUNTLET_BREAKDOWN
      )
      const genBreakdowns = allBreakdowns.slice(
        Math.max(0, allBreakdowns.length - populationSize)
      )
      if (genBreakdowns.length > 0) {
        generationSummaries.push(generationStats(genBreakdowns))
      }
    },
  })

  if (result.mode !== 'training') {
    throw new Error('Expected training result during reward screening.')
  }

  return {
    bestFitness: result.bestFitness,
    populationMean: result.populationFitnessMean,
    generations: generationSummaries,
  }
}

function printInspectSummary(
  label: string,
  stats: ReturnType<typeof summarizeStats>
): void {
  console.log(
    `  inspect ${label}: meanRawCorr=${fmtNum(stats.meanRawCorrelation)} meanFitCorr=${fmtNum(stats.meanFitCorrelation)} topRewardGate=${fmtNum(stats.finalTopRewardGate)} topRewardRaw=${fmtNum(stats.finalTopRewardRaw)} topRewardFit=${fmtNum(stats.finalTopRewardFitness)}`
  )
}

function summarizeRlScreen(
  rl: TrainingSummary,
  vanilla: TrainingSummary
): RlScreenSummary {
  const rlStats = summarizeStats(rl.generations)
  return {
    bestDelta: rl.bestFitness - vanilla.bestFitness,
    meanDelta:
      rl.populationMean != null && vanilla.populationMean != null
        ? rl.populationMean - vanilla.populationMean
        : null,
    meanRawCorrelation: rlStats.meanRawCorrelation,
    meanFitCorrelation: rlStats.meanFitCorrelation,
    topRewardGate: rlStats.finalTopRewardGate,
  }
}

function scoreScreenCandidate(summary: ScreenCandidateSummary): number {
  const a2cMean = summary.a2c.meanDelta ?? summary.a2c.bestDelta
  const ppoMean = summary.ppo.meanDelta ?? summary.ppo.bestDelta
  return (
    1.5 * summary.inspect.meanFitCorrelation +
    0.75 * summary.inspect.finalTopRewardGate +
    summary.a2c.bestDelta +
    summary.ppo.bestDelta +
    a2cMean +
    ppoMean +
    0.25 * (summary.a2c.meanRawCorrelation + summary.ppo.meanRawCorrelation) +
    0.25 * (summary.a2c.topRewardGate + summary.ppo.topRewardGate)
  )
}

async function runScreenCandidateSummary({
  candidate,
  options,
  profileOptions,
}: {
  candidate: CandidateSpec
  options: RewardScreenOptions
  profileOptions: Partial<TrainOptions>
}): Promise<ScreenCandidateSummary> {
  const inspectSummary = await runTrainingSummary({
    method: options.method,
    seed: `${options.seed}:${candidate.label}:inspect`,
    rewardConfig: candidate.rewardConfig,
    options: profileOptions,
    iterations: options.inspectIterations,
    populationSize: options.inspectPopulationSize,
    rlMode: 'none',
  })
  const inspect = summarizeStats(inspectSummary.generations)

  const vanillaSummary = await runTrainingSummary({
    method: options.method,
    seed: `${options.seed}:${candidate.label}:vanilla`,
    rewardConfig: candidate.rewardConfig,
    options: profileOptions,
    iterations: options.rlIterations,
    populationSize: options.rlPopulationSize,
    rlMode: 'none',
  })

  const a2cSummary = await runTrainingSummary({
    method: options.method,
    seed: `${options.seed}:${candidate.label}:a2c`,
    rewardConfig: candidate.rewardConfig,
    options: profileOptions,
    iterations: options.rlIterations,
    populationSize: options.rlPopulationSize,
    rlMode: 'a2c',
  })

  const ppoSummary = await runTrainingSummary({
    method: options.method,
    seed: `${options.seed}:${candidate.label}:ppo`,
    rewardConfig: candidate.rewardConfig,
    options: profileOptions,
    iterations: options.rlIterations,
    populationSize: options.rlPopulationSize,
    rlMode: 'ppo',
  })

  const summary: ScreenCandidateSummary = {
    candidate,
    inspect,
    a2c: summarizeRlScreen(a2cSummary, vanillaSummary),
    ppo: summarizeRlScreen(ppoSummary, vanillaSummary),
    score: 0,
  }
  summary.score = scoreScreenCandidate(summary)
  return summary
}

async function shortlistValidationCandidates(
  options: RewardValidationOptions,
  candidates: CandidateSpec[],
  profileOptions: Partial<TrainOptions>
): Promise<CandidateSpec[]> {
  const screenOptions: RewardScreenOptions = {
    seed: `${options.seed}:prescreen`,
    method: options.method,
    inspectIterations: Math.min(3, Math.max(1, options.iterations)),
    inspectPopulationSize: Math.min(100, Math.max(5, options.populationSize)),
    rlIterations: Math.min(3, Math.max(1, options.iterations)),
    rlPopulationSize: Math.min(100, Math.max(5, options.populationSize)),
    profileConfig: profileOptions,
    baseRewardConfig: options.baseRewardConfig,
  }

  console.log('=== Validation Shortlist Screen ===')
  console.log(
    `Inspect: iterations=${screenOptions.inspectIterations} population=${screenOptions.inspectPopulationSize}`
  )
  console.log(
    `RL diagnostic: iterations=${screenOptions.rlIterations} population=${screenOptions.rlPopulationSize}`
  )

  const summaries: ScreenCandidateSummary[] = []
  for (const candidate of candidates) {
    console.log(`  screening ${candidate.label}...`)
    const summary = await runScreenCandidateSummary({
      candidate,
      options: screenOptions,
      profileOptions,
    })
    summaries.push(summary)
    console.log(
      `    inspectFitCorr=${fmtNum(summary.inspect.meanFitCorrelation)} topRewardGate=${fmtNum(summary.inspect.finalTopRewardGate)} a2cBestDelta=${fmtNum(summary.a2c.bestDelta)} ppoBestDelta=${fmtNum(summary.ppo.bestDelta)} score=${fmtNum(summary.score)}`
    )
  }

  summaries.sort((a, b) => b.score - a.score)
  const shortlisted = summaries
    .slice(0, Math.min(SHORTLIST_CANDIDATE_LIMIT, summaries.length))
    .map((summary) => summary.candidate)

  console.log(
    `Shortlisted: ${shortlisted.map((candidate) => candidate.label).join(', ')}`
  )
  console.log()
  return shortlisted
}

export async function runRewardScreen(
  options: RewardScreenOptions
): Promise<void> {
  const profileOptions = (options.profileConfig ?? {}) as Partial<TrainOptions>
  const candidates = buildRewardCandidates(options.baseRewardConfig)

  console.log('\n=== Reward Screen ===')
  console.log(
    `Inspect: iterations=${options.inspectIterations} population=${options.inspectPopulationSize}`
  )
  console.log(
    `RL diagnostic: iterations=${options.rlIterations} population=${options.rlPopulationSize}`
  )
  console.log(`Candidates: ${candidates.map((c) => c.label).join(', ')}`)
  console.log()

  for (const candidate of candidates) {
    console.log(`=== Candidate: ${candidate.label} ===`)
    console.log(`Config: ${rewardConfigSummary(candidate.rewardConfig)}`)

    const summary = await runScreenCandidateSummary({
      candidate,
      options,
      profileOptions,
    })
    printInspectSummary(candidate.label, summary.inspect)
    console.log(
      `  a2c: bestDelta=${fmtNum(summary.a2c.bestDelta)} meanDelta=${summary.a2c.meanDelta == null ? 'n/a' : fmtNum(summary.a2c.meanDelta)} meanRawCorr=${fmtNum(summary.a2c.meanRawCorrelation)} topRewardGate=${fmtNum(summary.a2c.topRewardGate)}`
    )
    console.log(
      `  ppo: bestDelta=${fmtNum(summary.ppo.bestDelta)} meanDelta=${summary.ppo.meanDelta == null ? 'n/a' : fmtNum(summary.ppo.meanDelta)} meanRawCorr=${fmtNum(summary.ppo.meanRawCorrelation)} topRewardGate=${fmtNum(summary.ppo.topRewardGate)}`
    )
    console.log()
  }
}

interface AggregateValidation {
  bestDeltaMean: number
  meanDeltaMean: number | null
  rawCorrelationMean: number
  fitCorrelationMean: number
  topRewardGateMean: number
}

function aggregateValidation(
  rows: Array<{
    vanilla: TrainingSummary
    rl: TrainingSummary
  }>
): AggregateValidation {
  if (rows.length === 0) {
    return {
      bestDeltaMean: 0,
      meanDeltaMean: null,
      rawCorrelationMean: 0,
      fitCorrelationMean: 0,
      topRewardGateMean: 0,
    }
  }
  const bestDeltaMean =
    rows.reduce((sum, row) => sum + (row.rl.bestFitness - row.vanilla.bestFitness), 0) /
    rows.length
  const meanRows = rows.filter(
    (row) =>
      row.rl.populationMean != null && row.vanilla.populationMean != null
  )
  const meanDeltaMean =
    meanRows.length > 0
      ? meanRows.reduce(
          (sum, row) =>
            sum +
            ((row.rl.populationMean as number) -
              (row.vanilla.populationMean as number)),
          0
        ) / meanRows.length
      : null
  const rlStats = rows.map((row) => summarizeStats(row.rl.generations))
  return {
    bestDeltaMean,
    meanDeltaMean,
    rawCorrelationMean:
      rlStats.reduce((sum, stat) => sum + stat.meanRawCorrelation, 0) /
      rlStats.length,
    fitCorrelationMean:
      rlStats.reduce((sum, stat) => sum + stat.meanFitCorrelation, 0) /
      rlStats.length,
    topRewardGateMean:
      rlStats.reduce((sum, stat) => sum + stat.finalTopRewardGate, 0) /
      rlStats.length,
  }
}

function validationScore(
  a2c: AggregateValidation,
  ppo: AggregateValidation
): number {
  const meanPart =
    (a2c.meanDeltaMean ?? a2c.bestDeltaMean) +
    (ppo.meanDeltaMean ?? ppo.bestDeltaMean)
  return (
    a2c.bestDeltaMean +
    ppo.bestDeltaMean +
    meanPart +
    0.5 * (a2c.topRewardGateMean + ppo.topRewardGateMean) +
    0.25 * (a2c.rawCorrelationMean + ppo.rawCorrelationMean)
  )
}

function printValidationSummary(
  label: string,
  mode: ScreenRlMode,
  aggregate: AggregateValidation
): void {
  console.log(
    `  ${label} ${mode}: bestDeltaMean=${fmtNum(aggregate.bestDeltaMean)} meanDeltaMean=${aggregate.meanDeltaMean == null ? 'n/a' : fmtNum(aggregate.meanDeltaMean)} rawCorrMean=${fmtNum(aggregate.rawCorrelationMean)} fitCorrMean=${fmtNum(aggregate.fitCorrelationMean)} topRewardGateMean=${fmtNum(aggregate.topRewardGateMean)}`
  )
}

export async function runRewardValidation(
  options: RewardValidationOptions
): Promise<void> {
  const profileOptions = (options.profileConfig ?? {}) as Partial<TrainOptions>
  const allCandidates = buildRewardCandidates(options.baseRewardConfig)
  let candidates =
    options.candidateLabels != null && options.candidateLabels.length > 0
      ? allCandidates.filter((candidate) =>
          options.candidateLabels?.includes(candidate.label)
        )
      : allCandidates
  if (candidates.length === 0) {
    throw new Error('No reward candidates selected for validation.')
  }

  if (options.candidateLabels == null || options.candidateLabels.length === 0) {
    candidates = await shortlistValidationCandidates(
      options,
      candidates,
      profileOptions
    )
  }

  console.log('\n=== Reward Validation ===')
  console.log(
    `Iterations=${options.iterations} population=${options.populationSize} seeds=${options.seeds.join(', ')}`
  )
  console.log(`Candidates: ${candidates.map((c) => c.label).join(', ')}`)
  console.log()

  let bestCandidate:
    | {
        candidate: CandidateSpec
        a2c: AggregateValidation
        ppo: AggregateValidation
      }
    | undefined

  for (const candidate of candidates) {
    console.log(`=== Candidate: ${candidate.label} ===`)
    console.log(`Config: ${rewardConfigSummary(candidate.rewardConfig)}`)

    const a2cRows: Array<{ vanilla: TrainingSummary; rl: TrainingSummary }> = []
    const ppoRows: Array<{ vanilla: TrainingSummary; rl: TrainingSummary }> = []

    for (const seed of options.seeds) {
      const vanilla = await runTrainingSummary({
        method: options.method,
        seed: `${options.seed}:${candidate.label}:${seed}:vanilla`,
        rewardConfig: candidate.rewardConfig,
        options: profileOptions,
        iterations: options.iterations,
        populationSize: options.populationSize,
        rlMode: 'none',
      })
      for (const rlMode of ['a2c', 'ppo'] as const) {
        const rl = await runTrainingSummary({
          method: options.method,
          seed: `${options.seed}:${candidate.label}:${seed}:${rlMode}`,
          rewardConfig: candidate.rewardConfig,
          options: profileOptions,
          iterations: options.iterations,
          populationSize: options.populationSize,
          rlMode,
        })
        if (rlMode === 'a2c') {
          a2cRows.push({ vanilla, rl })
        } else {
          ppoRows.push({ vanilla, rl })
        }
      }
    }

    const a2c = aggregateValidation(a2cRows)
    const ppo = aggregateValidation(ppoRows)
    printValidationSummary(candidate.label, 'a2c', a2c)
    printValidationSummary(candidate.label, 'ppo', ppo)

    const candidateScore = validationScore(a2c, ppo)
    const bestScore =
      bestCandidate == null
        ? Number.NEGATIVE_INFINITY
        : validationScore(bestCandidate.a2c, bestCandidate.ppo)
    if (candidateScore > bestScore) {
      bestCandidate = { candidate, a2c, ppo }
    }
    console.log()
  }

  if (bestCandidate == null) return

  const actionBand = bestCandidate.candidate.rewardConfig.actionBandCost
  const turnConflict = bestCandidate.candidate.rewardConfig.turnConflictPenalty
  console.log('=== Recommendation ===')
  console.log(
    `Reward design: ${bestCandidate.candidate.label} (${rewardConfigSummary(bestCandidate.candidate.rewardConfig)})`
  )
  console.log(
    `Behavior cost: ${actionBand > 0 || turnConflict > 0 ? `actionBand=${actionBand} turnConflict=${turnConflict}` : 'disabled'}`
  )
  console.log(
    `Short-run screen: demo inspect screen --profile default --inspectIterations 3 --inspectPopulationSize 100 --rlIterations 3 --rlPopulationSize 100`
  )
  console.log(
    `15-gen validation: demo inspect validate --profile default --iterations 15 --populationSize ${options.populationSize} --seeds ${options.seeds.join(',')} --candidates ${bestCandidate.candidate.label}`
  )
}
