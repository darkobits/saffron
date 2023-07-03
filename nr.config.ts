import { nr } from '@darkobits/ts';


export default nr(({ script, command, isCI }) => {
  script('test.smoke', [[
    // ----- [Smoke Tests] CJS Host Package --------------------------------

    // Using a .ts Extension; should compile with esbuild.
    command.node('test.js', {
      name: 'tests:cjs:ts-extension',
      cwd: 'tests/fixtures/cjs/ts-extension'
    }),

    // Using a .mts extension; should compile with esbuild.
    command.node('test.js', {
      name: 'tests:cjs:mts-extension',
      cwd: 'tests/fixtures/cjs/mts-extension'
    }),

    // Using an .mjs extension; should load with import().
    command.node('test.js', {
      name: 'tests:cjs:mjs-extension',
      cwd: 'tests/fixtures/cjs/mjs-extension'
    }),

    // Using a .js extension; should compile with esbuild, loading issues a
    // node:35129 warning.
    command.node('test.js', {
      name: 'tests:cjs:js-extension',
      cwd: 'tests/fixtures/cjs/js-extension'
    }),


    // ----- [Smoke Tests] ESM Host Package --------------------------------

    // Using a .ts extension; should compile with esbuild.
    command.node('test.js', {
      name: 'tests:esm:ts-extension',
      cwd: 'tests/fixtures/esm/ts-extension'
    }),

    // Using a .js extension; should load with import().
    command.node('test.js', {
      name: 'tests:esm:js-extension',
      cwd: 'tests/fixtures/esm/js-extension'
    }),

    // Using a .cjs extension; should compile with esbuild, loading issues a
    // node:35129 warning.
    command.node('test.js', {
      name: 'tests:esm:cjs-extension',
      cwd: 'tests/fixtures/esm/cjs-extension'
    }),

    // Using a .cts extension; should compile with esbuild.
    command.node('test.js', {
      name: 'tests:esm:cts-extension',
      cwd: 'tests/fixtures/esm/cts-extension'
    })
  ]], {
    group: 'Test',
    description: 'Runs various tests on the built version of the project.',
    timing: true
  });

  if (!isCI) script('postBuild', ['script:test.smoke'] );
});
