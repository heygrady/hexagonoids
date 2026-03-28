import { defineProfile } from './defineProfile.js'

const turnDisciplineRigProfile = defineProfile({
  name: 'turn-discipline-rig',
  base: 'default',
  hooks: {
    reward: 'hexagonoids/turn-discipline-reward',
  },
  meta: {
    label: 'Turn Discipline Rig',
    description:
      'Scoring-hook example profile that swaps the reward rig while keeping the default config and fitness rig.',
    tags: ['example', 'runtime-hooks', 'scoring'],
  },
})

export default turnDisciplineRigProfile
