import type { OptionsSync as CosmiconfigSyncOptions } from 'cosmiconfig';
import type { NormalizedReadResult } from 'read-pkg-up';
import type yargs from 'yargs';


// ----- Miscellaneous ---------------------------------------------------------

export interface GenericObject {
  [key: string]: any;
}


/**
 * Object with the same shape as CosmiconfigResult, but with support for a typed
 * `config` key.
 */
export interface SaffronCosmiconfigResult<C> {
  config: C;
  filepath: string;
  isEmpty: boolean | undefined;
}


/**
 * Signature of an optional custom parser that may be returned from
 * Saffron.init() callbacks.
 */
type SaffronCustomParser = <A extends yargs.Arguments>(err: Error | null, argv: A, output: string | undefined) => void;


/**
 * Optional function that may be passed to Saffron.init(). This function will be
 * passed the Yargs object, and may perform any additional configuration prior
 * to arguments being parsed.
 */
export type SaffronInitCallback = (y: typeof yargs) => void | SaffronCustomParser | Promise<void | SaffronCustomParser>;


/**
 * Common options provided to builder and handler functions.
 */
export interface SaffronBuilderHandlerCommonOptions {
  /**
   * Parsed metadata about Saffron's host package.
   */
  pkg: {
    /**
     * Normalized package.json.
     *
     * See: https://github.com/npm/normalize-package-data
     */
    json: NormalizedReadResult['packageJson'] | undefined;

    /**
     * Path to the package root.
     */
    root: string | undefined;
  };
}


// ----- Builder Functions -----------------------------------------------------

/**
 * Object passed to a Saffron 'builder' function.
 */
export interface SaffronBuilderOptions<A> extends SaffronBuilderHandlerCommonOptions {
  command: yargs.Argv<A>;
}

/**
 * Signature of a Saffron 'builder' function.
 */
export type SaffronBuilder<A> = (options: SaffronBuilderOptions<A>) => void;


// ----- Handler Functions -----------------------------------------------------

/**
 * Object passed to a Saffron 'handler' function.
 */
export interface SaffronHandlerOptions<A, C> extends SaffronBuilderHandlerCommonOptions {
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


/**
 * Signature of a Saffron 'handler' function.
 */
export type SaffronHandler<A, C> = (options: SaffronHandlerOptions<A, C>) => Promise<void> | void;


// ----- Saffron Options -------------------------------------------------------

/**
 * Options for configuring Cosmiconfig.
 */
export interface SaffronCosmiconfigOptions extends CosmiconfigSyncOptions {
  /**
   * (Optional) If false, Saffron will not automatically configure the command
   * using data loaded from a configuration file.
   *
   * Default: `true`
   */
  auto?: boolean;

  /**
   * (Optional) Name to use as a base when searching for configuration files. If
   * omitted, the un-scoped portion of the project's package name will be used.
   */
  fileName: string | undefined;

  /**
   * (Optional) Specifies a key in loaded configuration files that should be
   * used as a scope for configuring this command. Useful when building
   * applications with several sub-commands.
   */
  key?: string;

  /**
   * (Optional) Path to begin searching for a configuration file.
   *
   * Default: process.cwd()
   */
  searchFrom?: string;
}


/**
 * Options object accepted by Saffron.
 *
 * A = Shape of the application's parsed arguments.
 *
 * C = Shape of the application's parsed configuration file, which by default
 *     has the same shape as A.
 */
export interface SaffronOptions<A extends GenericObject = any, C = A> {
  /**
   * If developing an application with multiple sub-commands, this should be
   * the name of the sub-command. Otherwise, this option can be omitted and
   * the root-level command will be assumed.
   *
   * See: https://github.com/yargs/yargs/blob/master/docs/advanced.md#positional-arguments
   *
   * Default: '*'
   */
  command?: yargs.CommandModule['command'];

  /**
   * List of aliases for the command being defined. This should only be used
   * when the `command` option has been set to something other than '*'.
   *
   * See: https://github.com/yargs/yargs/blob/master/docs/api.md#aliaskey-alias
   */
  aliases?: yargs.CommandModule['aliases'];

  /**
   * Description that will appear at the top of help content.
   *
   * Note: If a usage() is set in the builder function, it will override this
   * value.
   *
   * Default: "description" field from package.json.
   */
  description?: yargs.CommandModule['describe'];

  /**
   * (Optional) Command builder function, used to add and configure arguments
   * for the command.
   *
   * See: https://github.com/yargs/yargs/blob/master/docs/api.md#commandmodule
   */
  builder?: SaffronBuilder<A>;

  /**
   * Handler for the command.
   */
  handler: SaffronHandler<A, C>;

  /**
   * Configuration for Cosmiconfig. Will be merged with Saffron's defaults. This
   * can be set to `false` to disable configuration file support entirely.
   *
   * See: https://github.com/davidtheclark/cosmiconfig#cosmiconfigoptions
   */
  config?: Partial<SaffronCosmiconfigOptions> | false;

  /**
   * If `false`, Yargs strict mode will not be used. Disabling strict mode will
   * be necessary if auto-configuration is enabled _and_ an application's
   * configuration schema differs from its command-line argument schema.
   */
  strict?: boolean;
}
