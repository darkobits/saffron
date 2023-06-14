import { ts } from '@darkobits/eslint-plugin';

export default [
  ...ts,
  {
    rules: {
      'no-console': 'off',
      'unicorn/no-process-exit': 'off'
    }
  }
];
