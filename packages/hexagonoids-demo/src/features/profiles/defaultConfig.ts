import type { TrainingProfileConfig } from './types.js'

export const defaultConfig: TrainingProfileConfig = {
  populationSize: 100,
  method: 'HyperNEAT',
  iterations: 50,
  baseSeed: 'hexagonoids-phase03',
  dtMs: 33,

  // Fitness weights
  fitnessWeights: {
    rocksDestroyed: 0.7,
    accuracy: 0.3,
    targetKillRatio: 0.9,
    targetAccuracy: 0.3,
  },
  gateConfig: {
    survivalGateFloor: 0.2,
  },
  behavioralGateConfig: {
    thrust: { low: 0.15, high: 0.7, easing: 'exp', floor: 0.2 },
    fire: { low: 0.05, high: 0.6, easing: 'exp', floor: 0.2 },
    turn: { low: 0.15, high: 0.95, easing: 'exp', floor: 0.2 },
    turnBias: { max: 0.85, easing: 'cubic', floor: 0.2 },
    floor: 0.05,
  },

  // Evaluation blend
  scenarioWeight: 0.3,
  fullGameWeight: 0.4,
  curriculumWeight: 0.3,

  // Scenario settings
  scenariosPerOrganism: 128,
  scenarioMaxTicks: 64,

  // Curriculum settings
  curriculumCount: 48,

  // Full game settings
  maxTicks: 2048,
  fullGameSeedsPerOrganism: 2,

  // Training limits
  secondsLimit: 900,
  earlyStopPatience: 18,
}
