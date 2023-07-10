import { testFn } from './src/lib/utils';

// This tests that we can resolve paths to other files that themselves require
// a compilation step. Specifically, the Rollup strategy should be used, and
// the imported values should be inlined into the final config file.
if (!testFn()) {
  throw new Error('testFn failed');
}

export default {
  foo: 'bar'
};
