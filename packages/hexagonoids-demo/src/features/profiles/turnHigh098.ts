import { defineProfile } from './defineProfile.js'

const turnHigh098Profile = defineProfile({
  name: 'turn-high-098',
  base: 'default',
  config: {
    behavioralGateConfig: {
      turn: { high: 0.98 },
    },
  },
  meta: {
    label: 'Turn High 0.98',
    description:
      'Config-only example profile that raises the turn high gate while inheriting the default scoring rig.',
    tags: ['example', 'config-only', 'tuning'],
  },
})

export default turnHigh098Profile
