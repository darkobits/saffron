import command from 'lib/command';
import init from 'lib/init';

/**
 * Re-export selected types from 'yargs' in the event they are needed for
 * advanced use-cases.
 */
export {
  Arguments,
  Argv
} from 'yargs';


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
