import type { Options as CosmiconfigOptions } from 'cosmiconfig';
import type { NormalizedReadResult } from 'read-pkg-up';
import type yargs from 'yargs';


// ----- General ---------------------------------------------------------------

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
 * Optional function that may be passed to `init`. This function will be passed
 * the global Yargs object, and may perform any additional configuration prior
 * to arguments being parsed. It may be synchronous or asynchronous, and it may
 * optionally return a Yargs `ParseCallback` function.
 */
export type SaffronInitCallback = (y: typeof yargs) => void | yargs.ParseCallback | Promise<void | yargs.ParseCallback>;


/**
 * Common properties for contexts provided to builders and handlers.
 */
export interface SaffronCommonContext {
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


// ----- Builders --------------------------------------------------------------

/**
 * Context passed to builders.
 */
export interface SaffronBuilderContext<A> extends SaffronCommonContext {
  command: yargs.Argv<A>;
}

/**
 * Signature of a builder.
 */
export type SaffronBuilder<A> = (context: SaffronBuilderContext<A>) => void;


// ----- Handlers --------------------------------------------------------------

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


/**
 * Signature of handlers.
 */
export type SaffronHandler<A, C> = (context: SaffronHandlerContext<A, C>) => Promise<void> | void;


// ----- Configuration ---------------------------------------------------------

/**
 * Options for configuring Cosmiconfig.
 */
export interface SaffronCosmiconfigOptions extends CosmiconfigOptions {
  /**
   * (Optional) If false, Saffron will not automatically configure the command
   * using data loaded from a configuration file.
   *
   * @default true
   */
  auto?: boolean;

  /**
   * (Optional) Name to use as a base when searching for configuration files. If
   * omitted, the un-scoped portion of the project's package name will be used.
   */
  fileName?: string | undefined;

  /**
   * (Optional) Specifies a key in loaded configuration files that should be
   * used as a scope for configuring this command. Useful when building
   * applications with several sub-commands.
   */
  key?: string;

  /**
   * (Optional) Path to begin searching for a configuration file.
   *
   * @default process.cwd()
   */
  searchFrom?: string;
}


// ----- Commands --------------------------------------------------------------

/**
 * Options object accepted by Saffron's `command` function.
 *
 * A = Shape of the application's parsed CLI arguments.
 * C = Shape of the application's parsed configuration file, which by default
 *     has the same shape as A.
 */
export interface SaffronCommand<A extends Record<string, any> = Record<string, any>, C = A> {
  /**
   * String (or array of strings) that executes this command when given on the
   * command line. The first string should define any positional arguments for
   * the command. If developing an application with a single command and no
   * positional arguments, this option may be omitted.
   *
   * See: https://github.com/yargs/yargs/blob/master/docs/advanced.md#positional-arguments
   *
   * @default '*'
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
   * @default "description" field from package.json.
   */
  description?: yargs.CommandModule['describe'];

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
}
