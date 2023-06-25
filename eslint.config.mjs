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
      'unicorn/no-process-exit': 'off'
    }
  }
];
