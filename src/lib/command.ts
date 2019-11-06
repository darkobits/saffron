import camelcaseKeys from 'camelcase-keys';
import ow from 'ow';
import yargs, {Arguments, Argv} from 'yargs';

import {SaffronOptions} from 'etc/types';
import loadConfiguration, {CosmiconfigResult} from 'lib/configuration';
import getPackageInfo from 'lib/package';


/**
 * Integration between Yargs and Cosmiconfig.
 *
 * Type Parameters:
 *
 * C = Shape of the command's configuration and arguments, or a union of the two
 *     if they are divergent.
 */
export default function buildCommand<C = any>(options: SaffronOptions<C>) {
  // ----- Validate Options ----------------------------------------------------

  ow(options.command, 'command', ow.optional.string);
  ow(options.description, 'description', ow.optional.string);
  // @ts-ignore -- Typings on this are weird.
  ow(options.aliases, ow.optional.any(ow.string, ow.array.ofType(ow.string)));
  ow(options.builder, 'builder', ow.function);
  ow(options.handler, 'handler', ow.function);
  ow(options.strict, 'strict', ow.optional.boolean);
  ow(options.config, 'config', ow.optional.object.exactShape({
    fileName: ow.optional.string.nonEmpty,
    key: ow.optional.string.nonEmpty
  }));


  // ----- Get Package Info ----------------------------------------------------

  const {pkgJson, pkgRoot} = getPackageInfo();


  // ----- (Optional) Load Configuration File ----------------------------------

  let configForCommand: CosmiconfigResult;

  // Ensure we have either (a) a name from package.json or (b) a config.fileName
  // option. Otherwise, we can skip looking for a configuration file.
  if (options.config !== false && (pkgJson?.name || (options.config && options.config.fileName))) {
    configForCommand = loadConfiguration({
      fileName: pkgJson?.name,
      // N.B. If the user provided a custom fileName, it will overwrite the one
      // from package.json above.
      ...options.config
    });
  }


  // ----- Builder Proxy -------------------------------------------------------

  /**
   * This function wraps the "builder" function provided to Yargs, setting
   * default behaviors and passing any configuration loaded from cosmiconfig.
   */
  function builder(command: Argv<C>) {
    // Set strict mode unless otherwise indicated.
    if (options.strict !== false) {
      command.strict();
    }

    // Use the data from the configuration file to populate Yargs. This lets us
    // have a single path for validation/parsing.
    if (configForCommand && !configForCommand.isEmpty) {
      command.config(configForCommand.config);
    }

    // Apply defaults for the command.
    command.showHelpOnFail(true, 'See --help for usage instructions.');
    command.wrap(yargs.terminalWidth());
    command.alias('v', 'version');
    command.alias('h', 'help');
    command.version();
    command.help();

    // Call user-provided builder.
    options.builder(command);

    return command;
  }


  // ----- Handler Proxy -------------------------------------------------------

  /**
   * This function wraps the "handler" function provided to Yargs, allowing us
   * to provide several additional data to command handlers. We also ensure
   * that process.exit() is called when an (otherwise uncaught) error is thrown,
   * avoiding UncaughtPromiseException errors.
   */
  async function handler(argv: Arguments<C>) {
    try {
      await options.handler({
        // Strip "kebab-case" duplicate keys from argv.
        argv: camelcaseKeys(argv) as Arguments<C>,
        rawConfig: configForCommand?.config,
        configPath: configForCommand?.filepath ?? undefined,
        configIsEmpty: configForCommand?.isEmpty ?? undefined,
        packageJson: pkgJson?.packageJson ?? undefined,
        packageRoot: pkgRoot
      });
    } catch (err) {
      if (typeof err?.code === 'number') {
        process.exit(err.code);
      } else {
        process.exit(1);
      }
    }
  }


  // ----- Register Command ----------------------------------------------------

  yargs.command<C>({
    command: options.command || '*',
    describe: options?.description ?? pkgJson?.description ?? undefined,
    aliases: options.aliases,
    builder,
    handler
  });
}
