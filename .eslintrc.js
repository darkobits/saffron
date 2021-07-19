import { eslint } from '@darkobits/ts';

export default {
  extends: eslint,
  rules: {
    'unicorn/no-process-exit': 'off'
  }
};
