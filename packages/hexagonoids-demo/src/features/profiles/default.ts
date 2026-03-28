import { defaultConfig } from './defaultConfig.js'
import { defaultHooks } from './defaultHooks.js'
import { defineProfile } from './defineProfile.js'

const defaultProfile = defineProfile({
  name: 'default',
  config: defaultConfig,
  hooks: defaultHooks,
  meta: {
    label: 'Default',
    description:
      'Canonical Hexagonoids training profile with the default config and scoring rig metadata.',
    tags: ['default', 'baseline'],
  },
})

export default defaultProfile
