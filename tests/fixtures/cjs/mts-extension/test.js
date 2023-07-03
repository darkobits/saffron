const os = require('os');

const LogFactory = require('@darkobits/log');

const log = LogFactory({ heading: 'smokeTest' });

/**
 * Loading a TypeScript Configuration File in a CJS Project
 *
 * This tests that:
 *
 * 1. Saffron (an ESM package) can be dynamically-imported in a CJS package.
 * 2. Saffron can locate and parse a configuration file with an .mts extension
 *    where said file will be transpiled to ESM (because it has an .mjs
 *    extension).
 */
async function mtsToCjs() {
  try {
    const cli = await import('../../../../dist/index.js');

    cli.command({
      handler: ({ config }) => {
        if (config && Object.keys(config).length > 0) {
          log.verbose(log.prefix('cjs:mts-extension'), log.chalk.green('success'));
        } else {
          throw new Error('No config found.');
        }
      }
    });

    cli.init();
  } catch (err) {
    log.error(log.prefix('cjs:mts-extension'), log.chalk.gray(err.message.replaceAll(os.EOL, ' ')));
    log.verbose(err.stack);
    process.exit(1);
  }
}


void mtsToCjs();
