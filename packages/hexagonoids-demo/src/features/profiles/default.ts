import type { TrainingProfile } from './types.js'

const defaultProfile: TrainingProfile = {
  name: 'default',
  config: {
    populationSize: 100,
    method: 'HyperNEAT',
    iterations: 1000,
    fitnessWeights: {
      rocksDestroyed: 0.9,
      accuracy: 0.1,
    },
    gateConfig: {
      actionGateFloor: 0.2,
      actionLow: 0.02,
      actionHigh: 0.85,
      actionEasing: 'exp',
      turnFloor: 0.01,
      turnLow: 0.01,
      turnHigh: 0.8,
      turnEasing: 'cubic',
      turnBiasGateFloor: 0.01,
      turnBiasMax: 0.95,
      turnBiasEasing: 'cubic',
      survivalGateFloor: 0,
    },
    curriculumEnabled: true,
    curriculumCount: 32,
    scenarioWeight: 0.55,
    fullGameWeight: 0.05,
    curriculumWeight: 0.4,
    scenariosPerOrganism: 64,
    scenarioMaxTicks: 32,
    scenarioSeedsPerOrganism: 1,
    maxTicks: 2048,
    evaluationSeedsPerOrganism: 1,
    fullGameSeedsPerOrganism: 1,
    secondsLimit: 900,
    earlyStopPatience: 18,
    dtMs: 33,
    baseSeed: 'hexagonoids-phase03',
    scenarioMode: true,
  },
}

export default defaultProfile
