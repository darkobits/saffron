const os = require('os');

const LogFactory = require('@darkobits/log');

const log = LogFactory({ heading: 'smokeTest' });

/**
 * Loading an Explicitly ESM Configuration File in a CJS Project
 * This tests that:
 *
 * 1. Saffron (an ESM package) can be dynamically-imported in a CJS package.
 * 2. Saffron can locate and parse a configuration file with an .mjs extension
 *    where said file will be transpiled to ESM.
 *
 * Note that Saffron should be able to dynamically import this file without
 * having to resort to more exotic transpilation strategies.
 */
async function explicitEsm() {
  try {
    const cli = await import('../../../../dist/index.js');

    cli.command({
      handler: ({ config }) => {
        if (config && Object.keys(config).length > 0) {
          log.verbose(log.prefix('cjs:mjs-extension'), log.chalk.green('success'));
        } else {
          throw new Error('No config found.');
        }
      }
    });

    cli.init();
  } catch (err) {
    log.error(log.prefix('cjs:mjs-extension'), log.chalk.gray(err.message.replaceAll(os.EOL, ' ')));
    log.verbose(err.stack);
    process.exit(1);
  }
}


void explicitEsm();
