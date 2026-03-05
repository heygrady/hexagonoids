import type { TrainingProfile } from './types.js'

const defaultProfile: TrainingProfile = {
  name: 'default',
  config: {
    populationSize: 100,
    method: 'HyperNEAT',
    iterations: 50,
    fitnessWeights: {
      rocksDestroyed: 0.7,
      accuracy: 0.3,
      targetAccuracy: 0.3, // percentage of bullets landed that counts as "perfect"
    },
    gateConfig: {
      actionGateFloor: 0.1,
      actionLow: 0.01,
      actionHigh: 0.95,
      actionEasing: 'exp',
      turnFloor: 0.1,
      turnLow: 0.01,
      turnHigh: 0.95,
      turnEasing: 'cubic',
      turnBiasGateFloor: 0.1,
      turnBiasMax: 0.95,
      turnBiasEasing: 'cubic',
      survivalGateFloor: 0,
    },
    curriculumEnabled: true,
    curriculumCount: 32,
    scenarioWeight: 0.2,
    fullGameWeight: 0.4,
    curriculumWeight: 0.2,
    scenariosPerOrganism: 64,
    scenarioMaxTicks: 128,
    scenarioSeedsPerOrganism: 1,
    maxTicks: 1024,
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
