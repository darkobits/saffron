import type { Options as CosmiconfigOptions } from 'cosmiconfig';


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

  /**
   * (Optional) If provided, Saffron will skip searching for a configuration
   * file and instead use the file at the path specified at this key. This
   * option may be used to implement a `--config` parameter in a CLI that allows
   * the user to provide an explicit file path.
   */
  explicitConfigFileParam?: string;
}
