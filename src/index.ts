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
 * Export types.
 */
export * from 'etc/types';


/**
 * Allow named imports.
 *
 * @example
 *
 * import { command, init } from '@darkobits/saffron';
 *
 * command(...);
 * init(...);
 *
 * For a default-like import, use:
 *
 * import * as cli from '@darkobits/saffron';
 */
export { default as init } from 'lib/init';
export { default as command } from 'lib/command';
