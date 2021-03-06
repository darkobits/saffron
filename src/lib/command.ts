import camelcaseKeys from 'camelcase-keys';
import ow from 'ow';
import yargs, { Arguments, Argv } from 'yargs';

import {
  GenericObject,
  SaffronOptions,
  SaffronCosmiconfigResult
} from 'etc/types';
import loadConfiguration from 'lib/configuration';
import getPackageInfo from 'lib/package';


/**
 * Saffron command builder.
 *
 * Type Parameters:
 *
 * A = Shape of the application's parsed arguments.
 *
 * C = Shape of the application's parsed configuration file, which by default
 *     has the same shape as A.
 */
export default function buildCommand<A extends GenericObject = any, C extends GenericObject = A>(options: SaffronOptions<A, C>) {
  // ----- Validate Options ----------------------------------------------------

  ow(options.command, 'command', ow.optional.string);
  ow(options.description, 'description', ow.optional.string);
  ow(options.builder, 'builder', ow.any(ow.undefined, ow.function));
  ow(options.handler, 'handler', ow.function);
  ow(options.strict, 'strict', ow.optional.boolean);
  ow(options.config, 'config', ow.any(ow.boolean.false, ow.object, ow.undefined));
  // @ts-ignore -- Typings on this are weird.
  ow(options.aliases, 'aliases', ow.any(ow.undefined, ow.string, ow.array.ofType(ow.string)));


  // ----- Get Package Info ----------------------------------------------------

  const {pkgJson, pkgRoot} = getPackageInfo();


  // ----- (Optional) Load Configuration File ----------------------------------

  // Whether we should automatically call command.config() with the data from
  // the configuration file.
  let autoConfig = false;

  let configResult: SaffronCosmiconfigResult<C> | undefined;

  if (options.config !== false) {
    // If the user did not disable configuration file loading entirely, switch
    // autoConfig to `true` unless they explicitly set the `auto` option to
    // `false`.
    autoConfig = options.config?.auto !== false;

    configResult = loadConfiguration<C>({
      // By default, use the un-scoped portion of the package's name as the
      // configuration file name.
      fileName: pkgJson?.name ? pkgJson.name.split('/').slice(-1)[0] : undefined,
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
  const builder = (command: Argv<A>): Argv<A> => {
    // Set strict mode unless otherwise indicated.
    if (options.strict !== false) {
      command.strict();
    }

    // Apply defaults for the command.
    command.showHelpOnFail(true, 'See --help for usage instructions.');
    command.wrap(yargs.terminalWidth());
    command.alias('v', 'version');
    command.alias('h', 'help');
    command.version();
    command.help();

    // Call user-provided builder, additionally passing the (possible)
    // configuration file data we loaded.
    if (options.builder) {
      options.builder({
        command,
        config: configResult?.config,
        configPath: configResult?.filepath,
        configIsEmpty: configResult?.isEmpty,
        packageJson: pkgJson,
        packageRoot: pkgRoot
      });
    }

    // If autoConfig is still true and we successfully loaded data from a
    // configuration file, automatically configure the command using said data.
    // This lets us leverage Yargs to validate both CLI arguments and the
    // configuration data in a single code path.
    if (autoConfig && configResult && !configResult.isEmpty) {
      command.config(configResult.config);
    }

    return command;
  };


  // ----- Handler Decorator ---------------------------------------------------

  /**
   * This function wraps the "handler" function provided to Yargs, allowing us
   * to provide several additional data to command handlers. We also ensure
   * that process.exit() is called when an (otherwise uncaught) error is thrown,
   * avoiding UncaughtPromiseRejection errors.
   */
  const handler = async (argv: Arguments<A>) => {
    try {
      await options.handler({
        // Strip "kebab-case" duplicate keys from argv.
        argv: camelcaseKeys(argv, {deep: true}),
        config: configResult?.config ? camelcaseKeys(configResult.config, {deep: true})  : undefined,
        configPath: configResult?.filepath,
        configIsEmpty: configResult?.isEmpty,
        packageJson: pkgJson,
        packageRoot: pkgRoot
      });
    } catch (err) {
      if (typeof err?.exitCode === 'number') {
        process.exit(err.exitCode);
      } else if (typeof err?.code === 'number') {
        process.exit(err.code);
      } else {
        process.exit(1);
      }
    }
  };


  // ----- Register Command ----------------------------------------------------

  yargs.command<A>({
    command: options.command ?? '*',
    describe: options?.description ?? pkgJson?.description ?? undefined,
    aliases: options.aliases,
    // @ts-expect-error: Typings are wonky here as of Yargs 16.x.
    builder,
    handler
  });
}
