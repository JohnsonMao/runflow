import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.*'],
  rules: {
    'node/prefer-global/process': 'off',
    'no-nested-ternary': 'warn',
  },
  typescript: {
    parserOptions: {
      projectService: true,
    },
  },
})
