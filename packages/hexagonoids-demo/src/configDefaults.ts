export interface DemoDefaults {
  populationSize: number
  iterations: number
  secondsLimit: number
  earlyStopPatience: number
  evaluationSeedsPerOrganism: number
  maxTicks: number
  dtMs: number
  scenariosPerOrganism: number
  scenarioMaxTicks: number
}

export const DEMO_DEFAULTS: DemoDefaults = {
  populationSize: 64,
  iterations: 90,
  secondsLimit: 900,
  earlyStopPatience: 18,
  evaluationSeedsPerOrganism: 4,
  maxTicks: 1500,
  dtMs: 33,
  scenariosPerOrganism: 20,
  scenarioMaxTicks: 120,
}
