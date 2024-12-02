import os from 'os'

import { createLogger } from '@darkobits/log'

import * as cli from '../../../../dist/index.js'

const log = createLogger({ heading: 'smokeTest' })

/**
 * Loading a TypeScript Configuration File in a CJS Project
 *
 * This tests that:
 *
 * 1. Saffron can be imported in an ESM package.
 * 2. Saffron can locate and parse a configuration file with a .cts extension
 *    where said file will be transpiled to CJS.
 */
function explicitTypeScriptToCjs() {
  try {
    cli.command({
      builder: ({ command }) => {
        command.option('foo', {
          type: 'string',
          required: false
        })
      },
      handler: ({ config }) => {
        if (config && Object.keys(config).length > 0) {
          log.verbose(log.chalk.green('esm:cts-extension'), log.chalk.green('success'))
        } else {
          throw new Error('No config found.')
        }
      }
    })

    cli.init()
  } catch (err) {
    log.error(log.chalk.green('esm:cts-extension'), log.chalk.gray(err.message.replaceAll(os.EOL, ' ')))
    log.verbose(err.stack)
    process.exit(1)
  }
}

void explicitTypeScriptToCjs()