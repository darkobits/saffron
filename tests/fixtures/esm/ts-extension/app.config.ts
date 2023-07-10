// This is here to test that Rollup handles externals properly.
import path from 'path';

// This file should get transpiled to ESM because we have type: module in
// package.json.
// eslint-disable-next-line import/no-unresolved
import { testFn } from 'lib/utils';

// This tests that we can resolve paths to other files that themselves require
// a compilation step. Specifically, the Rollup strategy should be used, and
// the imported values should be inlined into the final config file.
if (!testFn()) throw new Error('testFn failed');

void path;

export default {
  foo: 'bar'
};
