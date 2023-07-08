import { ts } from '@darkobits/eslint-plugin';

export default [
  {
    files: [
      'eslint.config.mjs'
    ]
  },
  ...ts,
  {
    rules: {
      'no-console': 'off',
      'require-atomic-updates': 'off',
      'unicorn/no-process-exit': 'off',
      // TODO: Disable this rule in eslint-plugin.
      '@typescript-eslint/prefer-nullish-coalescing': 'off'
    }
  }
];
