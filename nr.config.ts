import { nr } from '@darkobits/ts';


export default nr(({ script, command }) => {
  script('test.smoke', {
    group: 'Testing',
    run: [
      [
        // ----- CJS Tests -----------------------------------------------------

        // esbuild
        command.node('smoke-test', ['test.js'], {
          execaOptions: { cwd: 'smoke-tests/cjs/ts-extension' }
        }),

        // esbuild
        command.node('smoke-test', ['test.js'], {
          execaOptions: { cwd: 'smoke-tests/cjs/mts-extension' }
        }),

        // import()
        command.node('smoke-test', ['test.js'], {
          execaOptions: { cwd: 'smoke-tests/cjs/mjs-extension' }
        }),

        // esbuild, issues node:35129 warning
        command.node('smoke-test', ['test.js'], {
          execaOptions: { cwd: 'smoke-tests/cjs/js-extension' }
        }),


        // ----- ESM Tests -----------------------------------------------------

        // esbuild
        command.node('smoke-test', ['test.js'], {
          execaOptions: { cwd: 'smoke-tests/esm/ts-extension' }
        }),

        // import()
        command.node('smoke-test', ['test.js'], {
          execaOptions: { cwd: 'smoke-tests/esm/js-extension' }
        }),

        // esbuild, issues node:35129 warning
        command.node('smoke-test', ['test.js'], {
          execaOptions: { cwd: 'smoke-tests/esm/cjs-extension' }
        }),

        // esbuild
        command.node('smoke-test', ['test.js'], {
          execaOptions: { cwd: 'smoke-tests/esm/cts-extension' }
        })
      ]
    ],
    timing: true
  });

  script('postPrepare', {
    run: ['script:test.smoke']
  });

});
