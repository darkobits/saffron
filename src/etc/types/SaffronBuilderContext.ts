import type { SaffronCommonContext } from './SaffronCommonContext';
import type { Argv } from 'yargs';


/**
 * Context passed to builders.
 */
export interface SaffronBuilderContext<A> extends SaffronCommonContext {
  command: Argv<A>;
}
