import { nr } from '@darkobits/ts';


export default nr(({ script, command, isCI }) => {
  script('test.smoke', {
    group: 'Test',
    description: 'Runs various tests on the built version of the project.',
    run: [
      [
        // ----- [Smoke Tests] CJS Host Package --------------------------------

        // Using a .ts Extension; should compile with esbuild.
        command.node('smoke-test', ['test.js'], {
          execaOptions: { cwd: 'smoke-tests/cjs/ts-extension' }
        }),

        // Using a .mts extension; should compile with esbuild.
        command.node('smoke-test', ['test.js'], {
          execaOptions: { cwd: 'smoke-tests/cjs/mts-extension' }
        }),

        // Using an .mjs extension; should load with import().
        command.node('smoke-test', ['test.js'], {
          execaOptions: { cwd: 'smoke-tests/cjs/mjs-extension' }
        }),

        // Using a .js extension; should compile with esbuild, loading issues a
        // node:35129 warning.
        command.node('smoke-test', ['test.js'], {
          execaOptions: { cwd: 'smoke-tests/cjs/js-extension' }
        }),


        // ----- [Smoke Tests] ESM Host Package --------------------------------

        // Using a .ts extension; should compile with esbuild.
        command.node('smoke-test', ['test.js'], {
          execaOptions: { cwd: 'smoke-tests/esm/ts-extension' }
        }),

        // Using a .js extension; should load with import().
        command.node('smoke-test', ['test.js'], {
          execaOptions: { cwd: 'smoke-tests/esm/js-extension' }
        }),

        // Using a .cjs extension; should compile with esbuild, loading issues a
        // node:35129 warning.
        command.node('smoke-test', ['test.js'], {
          execaOptions: { cwd: 'smoke-tests/esm/cjs-extension' }
        }),

        // Using a .cts extension; should compile with esbuild.
        command.node('smoke-test', ['test.js'], {
          execaOptions: { cwd: 'smoke-tests/esm/cts-extension' }
        })
      ]
    ],
    timing: true
  });

  if (!isCI) {
    script('postPrepare', {
      group: 'Lifecycle',
      run: ['script:test.smoke']
    });
  }
});
