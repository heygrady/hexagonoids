import type { TrainingProfile } from './types.js'

const defaultProfile: TrainingProfile = {
  name: 'default',
  config: {
    populationSize: 100,
    method: 'HyperNEAT',
    iterations: 1000,
    fitnessWeights: {
      rocksDestroyed: 0.8,
      accuracy: 0.2,
    },
    gateConfig: {
      actionGateFloor: 0.9,
      actionLow: 0.05,
      actionHigh: 0.6,
      actionEasing: 'exp',
      turnFloor: 0.05,
      turnLow: 0.02,
      turnHigh: 0.8,
      turnEasing: 'cubic',
      turnBiasGateFloor: 0.1,
      turnBiasMax: 0.7,
      turnBiasEasing: 'cubic',
      survivalGateFloor: 0,
    },
    curriculumEnabled: true,
    curriculumCount: 32,
    scenarioWeight: 0.15,
    fullGameWeight: 0.05,
    curriculumWeight: 0.8,
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
