/** Benchmark seeds used by record mode and served by the sessions API. */
export const BENCHMARK_SEEDS = [
  'benchmark-001',
  'benchmark-002',
  'benchmark-003',
  'benchmark-004',
  'benchmark-005',
]

/** Duration of each benchmark recording session in milliseconds. */
export const SESSION_DURATION = 10_000

/** Brief hold after countdown reaches 0 so "0" is visible before round starts. */
export const RECORD_COUNTDOWN_ZERO_HOLD_MS = 300

/** Observe mode defaults */
export const OBSERVE_MAX_GENERATIONS = 100
export const OBSERVE_SEED = 'observe-seed-001'
export const OBSERVE_WINDOW_MS = 10_000
export const OBSERVE_EVALUATION_SEEDS_PER_ORGANISM = 1
export const OBSERVE_SCENARIOS_PER_ORGANISM = 16
export const OBSERVE_SCENARIO_MAX_TICKS = 120
