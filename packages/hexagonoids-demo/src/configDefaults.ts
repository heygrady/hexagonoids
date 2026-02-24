export interface DemoDefaults {
  populationSize: number
  iterations: number
  secondsLimit: number
  earlyStopPatience: number
  evaluationSeedsPerOrganism: number
  maxTicks: number
  dtMs: number
}

export const DEMO_DEFAULTS: DemoDefaults = {
  populationSize: 60,
  iterations: 120,
  secondsLimit: 900,
  earlyStopPatience: 25,
  evaluationSeedsPerOrganism: 3,
  maxTicks: 1500,
  dtMs: 33,
}
