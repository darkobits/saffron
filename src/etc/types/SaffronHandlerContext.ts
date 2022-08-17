import type { SaffronCommonContext } from './SaffronCommonContext';
import type yargs from 'yargs';


/**
 * Context passed to handlers.
 */
export interface SaffronHandlerContext<A, C> extends SaffronCommonContext {
  /**
   * Parsed command line arguments merged with any file-based configuration and
   * validated by Yargs.
   */
  argv: yargs.Arguments<A>;

  /**
   * Parsed configuration file, if found.
   */
  config?: C;

  /**
    * Path where Cosmiconfig found a configuration file.
  */
  configPath?: string;

  /**
    * True if Cosmiconfig found a configuration file, but the file was empty.
    */
  configIsEmpty?: boolean;
}
