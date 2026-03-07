import type { TrainingProfile } from './types.js'

const defaultProfile: TrainingProfile = {
  name: 'default',
  config: {
    populationSize: 100,
    method: 'ES-HyperNEAT',
    iterations: 50,
    fitnessWeights: {
      rocksDestroyed: 0.9,
      accuracy: 0.1,
      targetAccuracy: 0.2, // percentage of bullets landed that counts as "perfect"
    },
    gateConfig: {
      actionGateFloor: 0.6,
      actionLow: 0.1,
      actionHigh: 0.9,
      actionEasing: 'exp',
      turnFloor: 0.01,
      turnLow: 0.01,
      turnHigh: 0.99,
      turnEasing: 'exp',
      turnBiasGateFloor: 0.01,
      turnBiasMax: 0.9,
      turnBiasEasing: 'exp',
      survivalGateFloor: 0,
    },
    curriculumEnabled: true,
    curriculumCount: 32,
    scenarioWeight: 0.3,
    fullGameWeight: 0.6,
    curriculumWeight: 0.1,
    scenariosPerOrganism: 128,
    scenarioMaxTicks: 64,
    scenarioSeedsPerOrganism: 1,
    maxTicks: 2048,
    evaluationSeedsPerOrganism: 1,
    fullGameSeedsPerOrganism: 2,
    secondsLimit: 900,
    earlyStopPatience: 18,
    dtMs: 33,
    baseSeed: 'hexagonoids-phase03',
    scenarioMode: true,
  },
}

export default defaultProfile
