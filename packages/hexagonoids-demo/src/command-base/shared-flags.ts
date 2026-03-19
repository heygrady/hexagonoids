import { Flags } from '@oclif/core'

import { SUPPORTED_ALGORITHMS } from '../features/registries/algorithmRegistry.js'

const GATE_EASINGS = ['linear', 'quad', 'cubic', 'exp', 'circle'] as const
const RL_MODES = ['none', 'ac', 'ql', 'a2c', 'dql', 'ppo'] as const
const THRUST_MATH_OPTIONS = ['fast', 'quaternion'] as const
const AGENT_OPTIONS = ['random', 'doNothing'] as const

const parseNumber = (input: string, name: string): number => {
  const parsed = Number(input)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid value for --${name}.`)
  }

  return parsed
}

const floatFlag = (name: string, summary: string, min = 0, max = 1) =>
  Flags.custom<number>({
    summary,
    parse: async (input) => {
      const parsed = parseNumber(input, name)
      if (parsed < min || parsed > max) {
        throw new Error(
          `Invalid value for --${name}. Must be between ${min} and ${max}.`
        )
      }

      return parsed
    },
  })

export const trainLikeFlags = {
  method: Flags.option({
    options: SUPPORTED_ALGORITHMS,
    summary: 'Training algorithm',
  })(),
  profile: Flags.string({
    summary: 'Profile name or path (.json/.mjs/.ts)',
  }),
  baseSeed: Flags.string({
    summary: 'Base seed for deterministic runs',
  }),
  evaluationSeedsPerOrganism: Flags.integer({
    min: 1,
    summary: 'Evaluation seeds per organism',
  }),
  maxTicks: Flags.integer({
    min: 1,
    summary: 'Maximum ticks per run',
  }),
  dtMs: Flags.integer({
    min: 1,
    summary: 'Simulation step size in milliseconds',
  }),
  thrustMath: Flags.option({
    options: THRUST_MATH_OPTIONS,
    summary: 'Math mode for thrust and movement',
  })(),
  populationSize: Flags.integer({
    min: 1,
    summary: 'Population size',
  }),
  iterations: Flags.integer({
    min: 1,
    summary: 'Training iterations',
  }),
  secondsLimit: Flags.integer({
    min: 1,
    summary: 'Wall-clock time limit in seconds',
  }),
  earlyStopPatience: Flags.integer({
    min: 1,
    summary: 'Early-stop patience',
  }),
  outputDir: Flags.string({
    summary: 'Artifact output directory',
  }),
  logInterval: Flags.integer({
    min: 1,
    summary: 'Generation logging interval',
  }),
  threadCount: Flags.integer({
    min: 1,
    summary: 'Worker thread count',
  }),
  scenarios: Flags.boolean({
    summary: 'Enable scenario-mode evaluation',
  }),
  scenariosPerOrganism: Flags.integer({
    min: 1,
    summary: 'Scenarios per organism',
  }),
  scenarioMaxTicks: Flags.integer({
    min: 1,
    summary: 'Maximum ticks per scenario',
  }),
  scenarioWeight: floatFlag(
    'scenarioWeight',
    'Blend weight for scenario scoring'
  )(),
  scenarioSeedsPerOrganism: Flags.integer({
    min: 1,
    summary: 'Scenario seeds per organism',
  }),
  fullGameSeedsPerOrganism: Flags.integer({
    min: 1,
    summary: 'Full-game seeds per organism',
  }),
  weightRocks: floatFlag('weightRocks', 'Rock destruction fitness weight')(),
  weightAccuracy: floatFlag('weightAccuracy', 'Accuracy fitness weight')(),
  actionGateFloor: floatFlag('actionGateFloor', 'Minimum action gate output')(),
  actionLow: floatFlag('actionLow', 'Low action gate threshold')(),
  actionHigh: floatFlag('actionHigh', 'High action gate threshold')(),
  actionEasing: Flags.option({
    options: GATE_EASINGS,
    summary: 'Action gate easing function',
  })(),
  turnGateFloor: floatFlag('turnGateFloor', 'Minimum turn gate output')(),
  turnLow: floatFlag('turnLow', 'Low turn gate threshold')(),
  turnHigh: floatFlag('turnHigh', 'High turn gate threshold')(),
  turnEasing: Flags.option({
    options: GATE_EASINGS,
    summary: 'Turn gate easing function',
  })(),
  throttleGateFloor: floatFlag(
    'throttleGateFloor',
    'Minimum throttle gate output'
  )(),
  throttleLow: floatFlag('throttleLow', 'Low throttle gate threshold')(),
  throttleHigh: floatFlag('throttleHigh', 'High throttle gate threshold')(),
  throttleEasing: Flags.option({
    options: GATE_EASINGS,
    summary: 'Throttle gate easing function',
  })(),
  survivalGateFloor: floatFlag(
    'survivalGateFloor',
    'Minimum survival gate output'
  )(),
  rl: Flags.option({
    options: RL_MODES,
    summary: 'Reinforcement-learning mode',
  })(),
  rlLearningRate: floatFlag('rlLearningRate', 'Reinforcement-learning rate')(),
  rlRewardThreshold: floatFlag(
    'rlRewardThreshold',
    'Reward threshold for rollout capture'
  )(),
  rlEpsilon: floatFlag('rlEpsilon', 'Initial epsilon for Q-learning')(),
  rlEpsilonDecay: floatFlag('rlEpsilonDecay', 'Epsilon decay for Q-learning')(),
  rlEpsilonMin: floatFlag('rlEpsilonMin', 'Minimum epsilon for Q-learning')(),
  rlRewardRock: floatFlag(
    'rlRewardRock',
    'Step reward per rock destroyed',
    -10,
    10
  )(),
  rlRewardDeath: floatFlag(
    'rlRewardDeath',
    'Step penalty per death (negative)',
    -10,
    10
  )(),
  rlRewardSurvival: floatFlag(
    'rlRewardSurvival',
    'Step reward per alive tick',
    -1,
    1
  )(),
  rlRewardScoreScale: floatFlag(
    'rlRewardScoreScale',
    'Step reward multiplier for engine score delta',
    -1,
    1
  )(),
  rlRewardShotPenalty: floatFlag(
    'rlRewardShotPenalty',
    'Step penalty per bullet fired',
    0,
    1
  )(),
  rlRewardWaveBonus: floatFlag(
    'rlRewardWaveBonus',
    'Step bonus for wave clear',
    -10,
    10
  )(),
  rlReplayCapacity: Flags.integer({
    min: 1,
    summary: 'DQL replay buffer capacity',
  }),
  rlReplayBatchSize: Flags.integer({
    min: 1,
    summary: 'DQL replay mini-batch size',
  }),
  rlTargetSyncInterval: Flags.integer({
    min: 1,
    summary: 'DQL target network sync interval',
  }),
  rlLamarckian: Flags.boolean({
    summary: 'Enable Lamarckian write-back',
  }),
  rlDarwinian: Flags.boolean({
    summary: 'Disable Lamarckian write-back',
  }),
}

export const replayFlags = {
  method: trainLikeFlags.method,
  seed: Flags.string({
    summary: 'Replay seed',
  }),
  maxTicks: trainLikeFlags.maxTicks,
  dtMs: trainLikeFlags.dtMs,
  thrustMath: trainLikeFlags.thrustMath,
}

export const inspectInputsFlags = {
  scenariosPerRun: Flags.integer({
    min: 1,
    summary: 'Scenarios to inspect',
  }),
  scenarioMaxTicks: Flags.integer({
    min: 1,
    summary: 'Maximum ticks per scenario',
  }),
  seed: Flags.string({
    summary: 'Inspection seed',
  }),
  agent: Flags.option({
    options: AGENT_OPTIONS,
    summary: 'Reference agent to simulate',
  })(),
  dtMs: Flags.integer({
    min: 1,
    summary: 'Simulation step size in milliseconds',
  }),
  verbose: Flags.boolean({
    summary: 'Print the verbose diagnostic sections',
  }),
}

export const inspectFitnessFlags = {
  scenariosPerOrganism: Flags.integer({
    min: 1,
    summary: 'Scenarios per organism',
  }),
  scenarioMaxTicks: Flags.integer({
    min: 1,
    summary: 'Maximum ticks per scenario',
  }),
  seed: Flags.string({
    summary: 'Inspection seed',
  }),
  dtMs: Flags.integer({
    min: 1,
    summary: 'Simulation step size in milliseconds',
  }),
  curriculum: Flags.boolean({
    summary: 'Enable curriculum evaluation',
  }),
  curriculumCount: Flags.integer({
    min: 1,
    summary: 'Curriculum scenario count',
  }),
  scenarioWeight: floatFlag('scenarioWeight', 'Scenario contribution weight')(),
  fullGameWeight: floatFlag(
    'fullGameWeight',
    'Full-game contribution weight'
  )(),
  curriculumWeight: floatFlag(
    'curriculumWeight',
    'Curriculum contribution weight'
  )(),
  maxTicks: Flags.integer({
    min: 1,
    summary: 'Maximum ticks for full-game evaluation',
  }),
  fullGameSeeds: Flags.integer({
    min: 1,
    summary: 'Full-game seed count',
  }),
  genome: Flags.string({
    summary: 'Genome pathname to inspect',
  }),
  lab: Flags.string({
    summary: 'Lab directory to inspect',
  }),
  method: trainLikeFlags.method,
  actionGateFloor: trainLikeFlags.actionGateFloor,
  turnGateFloor: trainLikeFlags.turnGateFloor,
  turnBiasGateFloor: floatFlag(
    'turnBiasGateFloor',
    'Minimum turn-bias gate output'
  )(),
}

export const scenariosFlags = {
  labRoot: Flags.string({
    summary: 'Root directory containing lab artifacts',
  }),
  'max-labs': Flags.integer({
    min: 1,
    summary: 'Maximum number of labs to scan',
  }),
  'hero-count': Flags.integer({
    min: 1,
    summary: 'Hero genomes per lab',
  }),
  'count-per-source': Flags.integer({
    min: 1,
    summary: 'Generated candidates per source genome',
  }),
  'panel-max': Flags.integer({
    min: 1,
    summary: 'Maximum review panel size',
  }),
  'panel-scout-count': Flags.integer({
    min: 1,
    summary: 'Scout candidates used for panel selection',
  }),
  rewind: Flags.integer({
    min: 1,
    summary: 'Rewind frames before scenario capture',
  }),
  'max-games': Flags.integer({
    min: 1,
    summary: 'Maximum games to simulate per source',
  }),
  'eval-ticks': Flags.integer({
    min: 1,
    summary: 'Evaluation ticks for panel scouting',
  }),
  'instant-death-trials': Flags.integer({
    min: 1,
    summary: 'Instant-death validation trials',
  }),
  'random-baseline-trials': Flags.integer({
    min: 1,
    summary: 'Random baseline validation trials',
  }),
  'final-count': Flags.integer({
    min: 1,
    summary: 'Final scenario bank size',
  }),
  seed: Flags.string({
    summary: 'Scenario generation seed',
  }),
  output: Flags.string({
    summary: 'Output pathname for the generated scenario bank',
  }),
  existing: Flags.string({
    summary: 'Existing bank pathname to merge from',
  }),
  'no-merge-existing': Flags.boolean({
    summary: 'Disable merge from the existing bank',
  }),
  report: Flags.string({
    summary: 'Detailed report output pathname',
  }),
  'dry-run': Flags.boolean({
    summary: 'Inspect sources without simulating scenarios',
  }),
}
