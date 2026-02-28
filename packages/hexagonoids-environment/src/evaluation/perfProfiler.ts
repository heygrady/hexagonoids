export type SimulationStage = 'agent' | 'step' | 'reward' | 'memory'

export interface SimulationProfiler {
  enabled: true
  start: (stage: SimulationStage) => number
  stop: (stage: SimulationStage, startedAt: number) => void
  onGameComplete: (ticks: number) => void
}
