import os from 'os';

import LogFactory from '@darkobits/log';

import * as cli from '../../../../dist/index.js';

const log = LogFactory({ heading: 'smokeTest' });

/**
 * Loading a TypeScript Configuration File in a CJS Project
 *
 * This tests that:
 *
 * 1. Saffron can be imported in an ESM package.
 * 2. Saffron can locate and parse a configuration file with a .ts extension
 *    where said file will be transpiled to ESM (because type:module is set in
 *    package.json).
 */
function typeScriptToImplicitEsm() {
  try {
    cli.command({
      builder: ({ command }) => {
        command.option('foo', {
          type: 'string',
          required: false
        });
      },
      handler: ({ config }) => {
        if (config && Object.keys(config).length > 0) {
          log.verbose(log.prefix('esm:ts-extension'), log.chalk.green('success'));
        } else {
          throw new Error('No config found.');
        }
      }
    });

    cli.init();
  } catch (err) {
    log.error(log.prefix('esm:ts-extension'), log.chalk.gray(err.message.replaceAll(os.EOL, ' ')));
    log.verbose(err.stack);
    process.exit(1);
  }
}


void typeScriptToImplicitEsm();
