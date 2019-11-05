import {Options as _CosmiconfigOptions} from 'cosmiconfig';
import {NormalizedReadResult} from 'read-pkg-up';
import {Arguments, CommandModule} from 'yargs';


/**
 * Cosmiconfig configuration options with the addition of 'moduleName'.
 */
export interface CosmiconfigOptions extends _CosmiconfigOptions {
  moduleName?: string;
}


/**
 * Object passed to a Ridley 'handler' function.
 */
export interface RidleyResults<C> {
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
   * Path to package.json.
   */
  packageJsonPath?: string;

  /**
   * Path to the package root.
   */
  packageRoot?: string;
}


/**
 * Signature of a Ridley 'handler' function.
 */
export type RidleyHandler<C> = (results: RidleyResults<C>) => Promise<any> | any;


/**
 * Options object accepted by Ridley.
 *
 * U = Shape of the application's parsed configuration file/arguments, which
 *     should in most cases have the same shape.
 */
export interface RidleyOptions<C = any> {
  /**
   *
   */
  command?: CommandModule['command'];

  /**
   * List of aliases for the command being defined.
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
  builder: CommandModule<C, C>['builder'];

  /**
   * Configuration for Cosmiconfig. Will be merged with Ridley's defaults.
   *
   * See: https://github.com/davidtheclark/cosmiconfig#cosmiconfigoptions
   */
  config?: CosmiconfigOptions;

  /**
   * If `false`, Yargs strict mode will not be used. Disabling strict mode will
   * be necessary if an application's configuration schema differs from its
   * command-line argument schema.
   */
  strict?: boolean;

  /**
   * Handler for the command.
   */
  handler: RidleyHandler<C>;
}
