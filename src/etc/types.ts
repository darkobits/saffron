import {Options as CosmiconfigOptions} from 'cosmiconfig';
import {NormalizedReadResult} from 'read-pkg-up';
import {Arguments, BuilderCallback, CommandModule} from 'yargs';


/**
 * Cosmiconfig configuration options with the addition of 'fileName', which is
 * typically provided as a separate parameter.
 */
export interface ExtendedCosmiconfigOptions extends CosmiconfigOptions {
  /**
   * (Optional) Name to use as a base when searching for configuration files. If
   * omitted, the un-scoped portion of the project's package name will be used.
   */
  fileName?: string;

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
 * Object passed to a Saffron 'handler' function.
 */
export interface SaffronResults<C> {
  /**
   * Parsed command line arguments merged with any file-based configuration and
   * validated by Yargs.
   */
  argv: Arguments<C>;

  /**
   * Entire config file as read by Cosmiconfig. Useful if your application
   * supports options that should only be configurable via file and not
   * command-line arguments.
   */
  rawConfig?: C;

  /**
   * Path where Cosmiconfig found a configuration file.
   */
  configPath?: string;

  /**
   * True if Cosmiconfig found a configuration file, but the file was empty.
   */
  configIsEmpty?: boolean;

  /**
   * Normalized package.json.
   *
   * See: https://github.com/npm/normalize-package-data
   */
  packageJson?: NormalizedReadResult['packageJson'];

  /**
   * Path to the package root.
   */
  packageRoot?: string;
}


/**
 * Signature of a Saffron 'handler' function, which differs from a Yargs handler
 * insofar as it accepts a SaffronResults object instead of just argv.
 */
export type SaffronHandler<C> = (results: SaffronResults<C>) => Promise<void> | void;


/**
 * Options object accepted by Saffron.
 *
 * C = Shape of the application's parsed configuration file/arguments, which
 *     should in most cases have the same shape.
 */
export interface SaffronOptions<C = any> {
  /**
   * If developing an application with multiple sub-commands, this should be
   * the name of the sub-command. Otherwise, this option can be omitted and
   * the root-level command will be assumed.
   *
   * See: https://github.com/yargs/yargs/blob/master/docs/advanced.md#positional-arguments
   *
   * Default: '*'
   */
  command?: CommandModule['command'];

  /**
   * List of aliases for the command being defined. This should only be used
   * when the `command` option has been set to something other than '*'.
   *
   * See: https://github.com/yargs/yargs/blob/master/docs/api.md#aliaskey-alias
   */
  aliases?: CommandModule['aliases'];

  /**
   * Description that will appear at the top of help content.
   *
   * Note: If a usage() is set in the builder function, it will override this
   * value.
   *
   * Default: "description" from package.json.
   */
  description?: CommandModule['describe'];

  /**
   * Command builder function, used to configure how command-line arguments are
   * defined, parsed, and validated.
   *
   * See: https://github.com/yargs/yargs/blob/master/docs/api.md#commandmodule
   */
  builder: BuilderCallback<C, C>;

  /**
   * Configuration for Cosmiconfig. Will be merged with Saffron's defaults. This
   * can be set to `false` to disable configuration file support entirely.
   *
   * See: https://github.com/davidtheclark/cosmiconfig#cosmiconfigoptions
   */
  config?: Partial<ExtendedCosmiconfigOptions> | false;

  /**
   * If `false`, Yargs strict mode will not be used. Disabling strict mode will
   * be necessary if an application's configuration schema differs from its
   * command-line argument schema.
   */
  strict?: boolean;

  /**
   * Handler for the command.
   */
  handler: SaffronHandler<C>;
}
