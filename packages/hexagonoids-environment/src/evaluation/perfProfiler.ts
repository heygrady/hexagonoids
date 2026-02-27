import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import type { ProfilingConfig } from '../HexagonoidsEnvironmentConfig.js'

export type SimulationStage = 'agent' | 'step' | 'reward' | 'memory'

export interface SimulationProfiler {
  enabled: true
  start: (stage: SimulationStage) => number
  stop: (stage: SimulationStage, startedAt: number) => void
  onGameComplete: (ticks: number) => void
}

type StageTotals = Record<SimulationStage, number>

function nowMs(): number {
  return performance.now()
}

function emptyStageTotals(): StageTotals {
  return {
    agent: 0,
    step: 0,
    reward: 0,
    memory: 0,
  }
}

class EnvironmentProfiler implements SimulationProfiler {
  public readonly enabled = true as const
  private readonly outputPath: string | undefined
  private readonly sampleEveryNGames: number
  private games = 0
  private ticks = 0
  private readonly totals: StageTotals = emptyStageTotals()
  private readonly current: StageTotals = emptyStageTotals()

  constructor(config: ProfilingConfig) {
    this.outputPath = config.outputPath
    this.sampleEveryNGames = Math.max(1, config.sampleEveryNGames)
  }

  start(_stage: SimulationStage): number {
    return nowMs()
  }

  stop(stage: SimulationStage, startedAt: number): void {
    this.current[stage] += nowMs() - startedAt
  }

  onGameComplete(ticks: number): void {
    this.games += 1
    this.ticks += ticks
    this.totals.agent += this.current.agent
    this.totals.step += this.current.step
    this.totals.reward += this.current.reward
    this.totals.memory += this.current.memory

    if (this.games % this.sampleEveryNGames === 0) {
      this.flush()
    }

    this.current.agent = 0
    this.current.step = 0
    this.current.reward = 0
    this.current.memory = 0
  }

  private flush(): void {
    if (this.outputPath == null) return

    const totalMs =
      this.totals.agent +
      this.totals.step +
      this.totals.reward +
      this.totals.memory
    const safeTotal = totalMs > 0 ? totalMs : 1
    const payload = {
      kind: 'hexagonoids-sim-profile',
      pid: process.pid,
      games: this.games,
      ticks: this.ticks,
      totalMs,
      stagesMs: { ...this.totals },
      stagePercent: {
        agent: (this.totals.agent / safeTotal) * 100,
        step: (this.totals.step / safeTotal) * 100,
        reward: (this.totals.reward / safeTotal) * 100,
        memory: (this.totals.memory / safeTotal) * 100,
      },
      msPerGame: totalMs / this.games,
      msPerTick: this.ticks > 0 ? totalMs / this.ticks : 0,
      timestamp: new Date().toISOString(),
    }
    mkdirSync(dirname(this.outputPath), { recursive: true })
    appendFileSync(this.outputPath, `${JSON.stringify(payload)}\n`, 'utf8')
  }
}

let singletonProfiler: EnvironmentProfiler | null = null

export function createSimulationProfiler(
  config: ProfilingConfig
): SimulationProfiler | undefined {
  if (!config.enabled) return undefined
  if (singletonProfiler == null) {
    singletonProfiler = new EnvironmentProfiler(config)
  }
  return singletonProfiler
}
