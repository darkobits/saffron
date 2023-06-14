import type { SaffronBuilder } from './SaffronBuilder';
import type { SaffronCosmiconfigOptions } from './SaffronCosmiconfigOptions';
import type { SaffronHandler } from './SaffronHandler';
import type { CommandModule } from 'yargs';


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
   * @default "description" field from package.json.
   */
  description?: CommandModule['describe'];

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
