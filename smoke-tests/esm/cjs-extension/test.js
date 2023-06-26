import os from 'os';

import LogFactory from '@darkobits/log';

import * as cli from '../../../dist/index.js';

const log = LogFactory({ heading: 'smokeTest' });


/**
 * Loading an Explicitly ESM Configuration File in a CJS Project
 * This tests that:
 *
 * 1. Saffron can be imported in an ESM package.
 * 2. Saffron can locate and parse a configuration file with a .cjs extension
 *    where said file will be transpiled to CJS.
 */
function explicitCjs() {
  try {
    cli.command({
      handler: ({ config }) => {
        if (config && Object.keys(config).length > 0) {
          log.verbose(log.prefix('esm:cjs-extension'), log.chalk.green('success'));
        } else {
          throw new Error('No config found.');
        }
      }
    });

    cli.init();
  } catch (err) {
    log.error(log.prefix('esm:cjs-extension'), log.chalk.gray(err.message.replaceAll(os.EOL, ' ')));
    log.verbose(err.stack);
    process.exit(1);
  }
}


void explicitCjs();