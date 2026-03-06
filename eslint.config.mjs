import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    '**/.runflow/**',
    '**/dist/**',
    '**/node_modules/**',
    '**/fixtures/**',
    '**/examples/**',
    '.cursor/**',
    '.agents/**',
    '**/*.timestamp-*',
    '**/*.md',
    '**/tsup.config.bundled_*.mjs',
  ],
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
