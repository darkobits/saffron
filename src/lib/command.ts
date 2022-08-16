import camelcaseKeys from 'camelcase-keys';

import {
  SaffronHandlerContext,
  SaffronCommand
} from 'etc/types';
import loadConfiguration from 'lib/configuration';
import ow from 'lib/ow';
import { getPackageInfo } from 'lib/package';
import yargs from 'lib/yargs';

import type { Argv, ArgumentsCamelCase } from 'yargs';


/**
 * Saffron command builder.
 */
export default function buildCommand<
  // Shape of the application's parsed command-line arguments.
  A extends Record<string, any> = Record<string, any>,
  // Shape of the application's parsed configuration file.
  C extends Record<string, any> = A
>(saffronCommand: SaffronCommand<A, C>) {
  // Validate options.
  ow(saffronCommand.command, 'command', ow.optional.string);
  ow(saffronCommand.description, 'description', ow.optional.string);
  ow(saffronCommand.strict, 'strict', ow.optional.boolean);
  ow(saffronCommand.config, 'config', ow.any(ow.boolean.false, ow.object, ow.undefined));
  ow(saffronCommand.aliases, 'aliases', ow.any(ow.string, ow.array.ofType(ow.string), ow.undefined));
  ow(saffronCommand.builder, 'builder', ow.optional.function);
  ow(saffronCommand.handler, 'handler', ow.function);

  // Get the host application's package manifest.
  const hostPkg = getPackageInfo('host');


  // ----- Builder Proxy -------------------------------------------------------

  /**
   * This function wraps the "builder" function provided to Yargs, setting
   * default behaviors.
   */
  const builder = (yargsCommand: Argv<any>): Argv<A> => {
    // Set strict mode unless explicitly disabled.
    if (saffronCommand.strict !== false) yargsCommand.strict();

    // Apply defaults for the command.
    yargsCommand.showHelpOnFail(true, 'See --help for usage instructions.');
    yargsCommand.wrap(yargs.terminalWidth());
    yargsCommand.alias('v', 'version');
    yargsCommand.alias('h', 'help');

    if (hostPkg.json?.version) yargsCommand.version(hostPkg.json.version);

    yargsCommand.help();

    // Call user-provided builder, additionally passing the (possible)
    // configuration file data we loaded.
    if (typeof saffronCommand.builder === 'function') {
      saffronCommand.builder({
        command: yargsCommand,
        pkg: getPackageInfo('host')
      });
    }

    return yargsCommand;
  };


  // ----- Handler Proxy -------------------------------------------------------

  /**
   * This function wraps the "handler" function provided to Yargs. It loads the
   * application's configuration file and provides the result several additional
   * data to command handlers. We also ensure that process.exit() is called when
   * an (otherwise uncaught) error is thrown, avoiding UncaughtPromiseRejection
   * errors.
   */
  const handler = async (argv: ArgumentsCamelCase<A>) => {
    const handlerOpts: Partial<SaffronHandlerContext<A, C>> = {};

    // Convert raw `argv` to camelCase.
    handlerOpts.argv = camelcaseKeys<any, any>(argv, {deep: true});

    handlerOpts.pkg = hostPkg;

    // Whether we should automatically call command.config() with the data
    // from the configuration file.

    if (saffronCommand.config !== false) {
      // If the user did not disable configuration file loading entirely, switch
      // autoConfig to `true` unless they explicitly set the `auto` option to
      // `false`.
      const autoConfig = saffronCommand.config?.auto !== false;

      // By default, use the un-scoped portion of the package's name as the
      // configuration file name. If for some reason the user hasn't defined one
      // in their package.json,
      const fileName = saffronCommand.config?.fileName ?? hostPkg.json?.name?.split('/').slice(-1)[0];

      const configResult = await loadConfiguration<C>({
        fileName,
        // N.B. If the user provided a custom fileName, it will overwrite the
        // one from package.json above.
        ...saffronCommand.config
      });

      if (configResult) {
        if (configResult.config) {
          handlerOpts.config = camelcaseKeys<any, any>(configResult.config, {deep: true});
        }

        handlerOpts.configPath = configResult.filepath;
        handlerOpts.configIsEmpty = Boolean(configResult.isEmpty);

        // If `autoConfig` is enabled, for each key in `argv`, set its value to
        // the corresponding value from `config`, if it exists.
        if (autoConfig && !handlerOpts.configIsEmpty) {
          Object.entries(configResult.config).forEach(([key, value]) => {
            if (handlerOpts.argv && handlerOpts.config && Reflect.has(handlerOpts.argv, key)) {
              Reflect.set(handlerOpts.argv, key, value);
            }
          });
        }
      }
    }

    try {
      // Finally, invoke the user's handler.
      await saffronCommand.handler(handlerOpts as Required<SaffronHandlerContext<A, C>>);
    } catch (err: any) {
      console.error(err);

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
    command: saffronCommand.command ?? '*',
    describe: saffronCommand.description ?? hostPkg.json?.description,
    aliases: saffronCommand.aliases,
    builder,
    handler
  });
}
