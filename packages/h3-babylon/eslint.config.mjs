import config from '@heygrady/eslint-config/ts-node-esm.js'

export default [
  ...config,
  {
    ignores: ['.turbo/', 'dist/', 'coverage/', 'node_modules/'],
  },
]
