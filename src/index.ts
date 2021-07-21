import command from 'lib/command';
import init from 'lib/init';


/**
 * [Types]
 *
 * Re-export selected types from 'yargs' in the event they are needed for
 * advanced use-cases.
 */
export type {
  Arguments,
  Argv
} from 'yargs';


/**
 * [Types]
 *
 * Export selected types from 'etc/types'.
 */
export type {
  SaffronBuilder,
  SaffronBuilderOptions,
  SaffronHandler,
  SaffronHandlerOptions
} from 'etc/types';


/**
 * Allow named imports.
 *
 * @example
 *
 * import {cli, init} from '@darkobits/saffron';
 *
 * cli(...);
 * init(...);
 */
export {
  init,
  command
};


/**
 * Allow a default import with named properties.
 *
 * @example
 *
 * import saffron from '@darkobits/saffron';
 *
 * saffron.command(...);
 * saffron.init(...);
 */
export default {
  init,
  command
};
