require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  extends: ['@heygrady/eslint-config-astro'],
  rules: {
    'n/no-missing-import': 'off',
  },
}
