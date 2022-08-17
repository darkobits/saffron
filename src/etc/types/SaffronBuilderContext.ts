import type { SaffronCommonContext } from './SaffronCommonContext';
import type yargs from 'yargs';


/**
 * Context passed to builders.
 */
export interface SaffronBuilderContext<A> extends SaffronCommonContext {
  command: yargs.Argv<A>;
}
