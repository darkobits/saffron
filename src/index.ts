import command from 'lib/command';
import init from 'lib/init';


/**
 * [Types]
 *
 * Re-export selected types from 'yargs' in the event they are needed for
 * advanced use-cases.
 */
export type { Arguments, Argv } from 'yargs';


/**
 * [Types]
 *
 * Export selected types from 'etc/types'.
 */
export type {
  SaffronBuilder,
  SaffronBuilderContext,
  SaffronHandler,
  SaffronHandlerContext
} from 'etc/types';


/**
 * Allow named imports.
 *
 * @example
 *
 * import { command, init } from '@darkobits/saffron';
 *
 * command(...);
 * init(...);
 */
export { default as init } from 'lib/init';
export { default as command } from 'lib/command';


/**
 * Allow a default import with named properties.
 *
 * @example
 *
 * import cli from '@darkobits/saffron';
 *
 * cli.command(...);
 * cli.init(...);
 */
export default { init, command };
