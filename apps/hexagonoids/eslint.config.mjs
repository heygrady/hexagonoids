import config from '@heygrady/eslint-config/astro-solid.js'

export default [
  ...config,
  {
    ignores: [
      '.turbo/',
      '.vercel/',
      'dist/',
      'coverage/',
      'public/',
      'CHANGELOG.md',
      'node_modules/',
    ],
  },
  {
    rules: {
      'n/no-missing-import': 'off',
    },
  },
]
