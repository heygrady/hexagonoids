import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Flags } from '@oclif/core'
import { createMemoryRecorder } from '@neat-evolution/stats'
import { METRIC_GAUNTLET_BREAKDOWN, type GauntletBreakdown } from '@heygrady/hexagonoids-environment'

import { formatNumber } from '../command-base/output.js'
import { trainLikeFlags } from '../command-base/shared-flags.js'
import { TrainLikeCommand } from '../command-base/train-like-command.js'
import { summarizeGenerationAlignment } from '../features/inspect/rewardAlignment.js'
import { DEFAULT_ARTIFACTS_DIR } from '../features/persistence/artifactPaths.js'
import {
  analyzeHeapProfile,
  analyzeProfile,
  type BottleneckRecord,
  type HeapRecord,
} from '../features/profiling/analyzeProfile.js'
import { type TrainOptions, train } from '../features/training/train.js'

export default class RlDiagnosticCommand extends TrainLikeCommand {
  static override summary =
    'Train one RL variant and report training telemetry.'

  static override description =
    'Runs training with the specified --rl mode and reports per-generation fitness progression. Use --cpuProfile to capture and analyze worker bottlenecks.'

  static override examples = [
    '<%= config.bin %> rl-diagnostic --rl ppo --iterations 10 --populationSize 50',
    '<%= config.bin %> rl-diagnostic --rl ppo --method HyperNEAT --cpuProfile --iterations 3',
    '<%= config.bin %> rl-diagnostic --rl ppo --cpuProfile --heapProfile --baseSeed profile-bench --iterations 3 --populationSize 25',
  ]

  static override flags = {
    ...trainLikeFlags,
    cpuProfile: Flags.boolean({
      summary:
        'Capture V8 CPU profiles from worker threads and analyze bottlenecks',
    }),
    heapProfile: Flags.boolean({
      summary:
        'Capture V8 heap sampling profiles from worker threads and analyze allocations',
    }),
    inspectAlignment: Flags.boolean({
      summary: 'Emit reward-fitness alignment summaries during RL evaluation',
    }),
    alignmentTopN: Flags.integer({
      summary: 'Top organisms to print in alignment summaries',
      min: 1,
    }),
  }

  override async run(): Promise<void> {
    const { flags } = await this.parse(RlDiagnosticCommand)
    const profileRef =
      typeof flags.profile === 'string' ? flags.profile : undefined
    const profile = await this.resolveProfile(profileRef)
    const flagOptions = this.flagsToTrainOptions(flags)
    // When --iterations is explicitly provided, disable early stop and time
    // limit so the diagnostic always runs the requested number of generations.
    const iterations =
      typeof flags.iterations === 'number' ? flags.iterations : undefined
    const disableEarlyStop =
      iterations != null
        ? { earlyStopPatience: iterations + 1, secondsLimit: 0 }
        : {}
    const options = this.mergeTrainOptions(
      profile.config,
      flagOptions,
      { baselineOnly: false },
      disableEarlyStop
    )

    const rlMode = options.rlMode ?? 'none'
    if (rlMode === 'none') {
      this.error(
        'Specify an RL mode with --rl (e.g. --rl ppo, --rl dql, --rl a2c)'
      )
    }

    const cpuProfile = flags.cpuProfile === true
    const heapProfile = flags.heapProfile === true
    const outputDir = options.outputDir ?? DEFAULT_ARTIFACTS_DIR
    const inspectAlignment = flags.inspectAlignment === true
    const alignmentTopN =
      typeof flags.alignmentTopN === 'number' ? flags.alignmentTopN : 2
    const alignmentRecorder = inspectAlignment
      ? createMemoryRecorder([METRIC_GAUNTLET_BREAKDOWN])
      : undefined

    this.log(`Using profile: ${profile.label}`)
    this.log(`RL mode: ${rlMode}`)
    this.log(
      `Population: ${options.populationSize ?? 100}  Iterations: ${options.iterations ?? 50}  LR: ${options.rlLearningRate ?? 0.001}`
    )
    this.log(
      `Gauntlet: scenarios=${options.scenarioWeight ?? 0.3} fullGame=${options.fullGameWeight ?? 0.6} curriculum=${options.curriculumWeight ?? 0.1}`
    )
    const profilingParts: string[] = []
    if (cpuProfile) profilingParts.push('CPU')
    if (heapProfile) profilingParts.push('Heap')
    this.log(
      `Threads: ${options.threadCount ?? 'default'}  Profiling: ${profilingParts.length > 0 ? profilingParts.join('+') : 'off'}`
    )
    this.logRewardConfig(options)
    this.log()

    // Run Vanilla baseline for comparison
    this.log('=== Vanilla Baseline ===')
    const vanillaOptions: TrainOptions = {
      ...options,
      rlMode: 'none',
    }
    const vanillaResult = await train(vanillaOptions)
    if (vanillaResult.mode === 'training') {
      this.log(`Best Fitness: ${formatNumber(vanillaResult.bestFitness)}`)
      if (vanillaResult.populationFitnessMean != null) {
        this.log(
          `Population Mean: ${formatNumber(vanillaResult.populationFitnessMean)}`
        )
      }
    }
    this.log()

    // Run RL variant (with optional CPU profiling)
    this.log(`=== ${rlMode.toUpperCase()}-Lamarck Training ===`)
    if (
      options.speciationThreshold != null ||
      options.speciationThresholdMoveAmount != null
    ) {
      this.log(
        `Speciation: threshold=${options.speciationThreshold ?? 'default'} moveAmount=${options.speciationThresholdMoveAmount ?? 'default'}`
      )
    }
    const rlOptions: TrainOptions = {
      ...options,
      ...(cpuProfile && { workerCpuProfiles: true }),
      ...(heapProfile && { workerHeapProfiles: true }),
      ...(alignmentRecorder != null && { stats: alignmentRecorder }),
      ...(inspectAlignment && {
        afterEvaluate: (population: unknown, iteration: number) => {
          const allBreakdowns = alignmentRecorder?.get<GauntletBreakdown>(
            METRIC_GAUNTLET_BREAKDOWN
          )
          const populationSize = options.populationSize ?? 100
          const genBreakdowns =
            allBreakdowns?.slice(Math.max(0, allBreakdowns.length - populationSize)) ??
            []
          if (genBreakdowns.length === 0) return
          const pop = population as { species: { size: number } }
          for (const line of summarizeGenerationAlignment(
            iteration,
            pop.species.size,
            genBreakdowns,
            { topN: alignmentTopN, showComponents: true, showModes: false }
          )) {
            this.log(line)
          }
        },
      }),
    }
    const rlResult = await train(rlOptions)
    if (rlResult.mode !== 'training') {
      this.error('Expected training mode result.')
    }

    this.log(`Best Fitness: ${formatNumber(rlResult.bestFitness)}`)
    if (rlResult.populationFitnessMean != null) {
      this.log(
        `Population Mean: ${formatNumber(rlResult.populationFitnessMean)}`
      )
    }
    if (rlResult.populationFitnessMedian != null) {
      this.log(
        `Population Median: ${formatNumber(rlResult.populationFitnessMedian)}`
      )
    }
    this.log(`Best File: ${rlResult.bestFilePath}`)
    this.log()

    // Comparison
    this.log('=== Comparison ===')
    const vanillaBest =
      vanillaResult.mode === 'training' ? vanillaResult.bestFitness : 0
    const vanillaMean =
      vanillaResult.mode === 'training'
        ? vanillaResult.populationFitnessMean
        : null
    const delta = rlResult.bestFitness - vanillaBest
    const sign = delta >= 0 ? '+' : ''
    this.log(
      `Vanilla best:  ${formatNumber(vanillaBest)}    ${rlMode.toUpperCase()} best:  ${formatNumber(rlResult.bestFitness)}    delta: ${sign}${formatNumber(delta)}`
    )
    if (vanillaMean != null && rlResult.populationFitnessMean != null) {
      const meanDelta = rlResult.populationFitnessMean - vanillaMean
      const meanSign = meanDelta >= 0 ? '+' : ''
      this.log(
        `Vanilla mean:  ${formatNumber(vanillaMean)}    ${rlMode.toUpperCase()} mean:  ${formatNumber(rlResult.populationFitnessMean)}    delta: ${meanSign}${formatNumber(meanDelta)}`
      )
    }
    this.log()
    this.log(`Generations Log: ${rlResult.generationsLogPath}`)

    // Profile analysis
    if (cpuProfile || heapProfile) {
      const profileDir = join(outputDir, 'worker-cpu-profiles')
      this.log()
      this.log(`=== Worker Profile Analysis (${profileDir}) ===`)
      this.analyzeWorkerProfiles(profileDir)
    }
  }

  private analyzeWorkerProfiles(profileDir: string): void {
    let allFiles: string[]
    try {
      allFiles = readdirSync(profileDir).sort()
    } catch {
      this.log('No profile files found.')
      return
    }

    // Only analyze evaluator profiles — reproducer workers don't run RL
    const cpuFiles = allFiles.filter(
      (f) => f.endsWith('.cpuprofile') && f.startsWith('evaluator-')
    )
    const heapFiles = allFiles.filter(
      (f) => f.endsWith('.heapprofile') && f.startsWith('evaluator-')
    )

    if (cpuFiles.length === 0 && heapFiles.length === 0) {
      this.log('No evaluator profile files found.')
      return
    }

    if (cpuFiles.length > 0) {
      this.log()
      this.log(`--- CPU (${cpuFiles.length} evaluator workers merged) ---`)
      const merged = this.mergeCpuProfiles(profileDir, cpuFiles)
      for (const record of merged) {
        this.log(JSON.stringify(record))
      }
    }

    if (heapFiles.length > 0) {
      this.log()
      this.log(`--- Heap (${heapFiles.length} evaluator workers merged) ---`)
      const merged = this.mergeHeapProfiles(profileDir, heapFiles)
      for (const record of merged) {
        this.log(JSON.stringify(record))
      }
    }
  }

  private mergeCpuProfiles(
    profileDir: string,
    files: string[]
  ): BottleneckRecord[] {
    // Analyze each file individually with generous limits, then aggregate
    const allRecords: BottleneckRecord[] = []
    for (const file of files) {
      const content = readFileSync(join(profileDir, file), 'utf8')
      const records = analyzeProfile(content, 50, 0.005)
      allRecords.push(...records)
    }
    return this.aggregateCpuRecords(allRecords, files.length, 15)
  }

  private mergeHeapProfiles(profileDir: string, files: string[]): HeapRecord[] {
    const allRecords: HeapRecord[] = []
    for (const file of files) {
      const content = readFileSync(join(profileDir, file), 'utf8')
      const records = analyzeHeapProfile(content, 50, 0.005)
      allRecords.push(...records)
    }
    return this.aggregateHeapRecords(allRecords, files.length, 15)
  }

  /** Merge CPU bottleneck records across workers by function+file key, averaging times. */
  private aggregateCpuRecords(
    records: BottleneckRecord[],
    workerCount: number,
    topN: number
  ): BottleneckRecord[] {
    const byKey = new Map<
      string,
      {
        record: BottleneckRecord
        selfMsSum: number
        totalMsSum: number
        count: number
      }
    >()

    for (const r of records) {
      const key = `${r.function}|${r.file}|${r.line}`
      const existing = byKey.get(key)
      if (existing) {
        existing.selfMsSum += r.selfMs
        existing.totalMsSum += r.totalMs
        existing.count += 1
        // Keep the record with the most call paths
        if (r.callPaths.length > existing.record.callPaths.length) {
          existing.record = r
        }
      } else {
        byKey.set(key, {
          record: r,
          selfMsSum: r.selfMs,
          totalMsSum: r.totalMs,
          count: 1,
        })
      }
    }

    const merged: BottleneckRecord[] = []
    for (const { record, selfMsSum, totalMsSum } of byKey.values()) {
      const avgSelfMs = selfMsSum / workerCount
      const avgTotalMs = totalMsSum / workerCount
      const exclusivePct = avgTotalMs > 0 ? avgSelfMs / avgTotalMs : 0
      const score = Math.round(avgSelfMs * (0.35 + exclusivePct) * 10) / 10
      merged.push({
        ...record,
        selfMs: Math.round(avgSelfMs * 100) / 100,
        totalMs: Math.round(avgTotalMs * 100) / 100,
        exclusivePct: Math.round(exclusivePct * 1000) / 1000,
        score,
        rank: 0,
      })
    }

    merged.sort((a, b) => b.score - a.score)
    for (let i = 0; i < merged.length; i++) {
      const r = merged[i]
      if (r) r.rank = i + 1
    }
    return merged.slice(0, topN)
  }

  /** Merge heap records across workers by function+file key, averaging sizes. */
  private aggregateHeapRecords(
    records: HeapRecord[],
    workerCount: number,
    topN: number
  ): HeapRecord[] {
    const byKey = new Map<
      string,
      {
        record: HeapRecord
        selfKBSum: number
        totalKBSum: number
        count: number
      }
    >()

    for (const r of records) {
      const key = `${r.function}|${r.file}|${r.line}`
      const existing = byKey.get(key)
      if (existing) {
        existing.selfKBSum += r.selfKB
        existing.totalKBSum += r.totalKB
        existing.count += 1
        if (r.callPaths.length > existing.record.callPaths.length) {
          existing.record = r
        }
      } else {
        byKey.set(key, {
          record: r,
          selfKBSum: r.selfKB,
          totalKBSum: r.totalKB,
          count: 1,
        })
      }
    }

    const merged: HeapRecord[] = []
    for (const { record, selfKBSum, totalKBSum } of byKey.values()) {
      const avgSelfKB = selfKBSum / workerCount
      const avgTotalKB = totalKBSum / workerCount
      const exclusivePct = avgTotalKB > 0 ? avgSelfKB / avgTotalKB : 0
      const score = Math.round(avgSelfKB * (0.35 + exclusivePct) * 10) / 10
      merged.push({
        ...record,
        selfKB: Math.round(avgSelfKB * 10) / 10,
        totalKB: Math.round(avgTotalKB * 10) / 10,
        exclusivePct: Math.round(exclusivePct * 1000) / 1000,
        score,
        rank: 0,
      })
    }

    merged.sort((a, b) => b.score - a.score)
    for (let i = 0; i < merged.length; i++) {
      const r = merged[i]
      if (r) r.rank = i + 1
    }
    return merged.slice(0, topN)
  }

  private logRewardConfig(options: TrainOptions): void {
    const parts: string[] = []
    if (options.rlRewardRock != null) parts.push(`rock=${options.rlRewardRock}`)
    if (options.rlRewardDeath != null)
      parts.push(`death=${options.rlRewardDeath}`)
    if (options.rlRewardSurvival != null)
      parts.push(`survival=${options.rlRewardSurvival}`)
    if (options.rlRewardEngagement != null)
      parts.push(`engagement=${options.rlRewardEngagement}`)
    if (options.rlRewardProgress != null)
      parts.push(`progress=${options.rlRewardProgress}`)
    if (options.rlRewardScoreScale != null)
      parts.push(`scoreScale=${options.rlRewardScoreScale}`)
    if (options.rlRewardShotPenalty != null)
      parts.push(`shotPenalty=${options.rlRewardShotPenalty}`)
    if (options.rlRewardWaveBonus != null)
      parts.push(`waveBonus=${options.rlRewardWaveBonus}`)
    if (options.rlRewardBulletAim != null)
      parts.push(`bulletAim=${options.rlRewardBulletAim}`)
    if (options.rlRewardBulletAimOutOfRange != null)
      parts.push(`bulletAimOOR=${options.rlRewardBulletAimOutOfRange}`)
    if (parts.length > 0) {
      this.log(`Reward overrides: ${parts.join(', ')}`)
    } else {
      this.log(
        'Reward config: defaults (rock=1, death=-0.5, survival=0.002, engagement=0.01, progress=0.05)'
      )
    }
  }
}
