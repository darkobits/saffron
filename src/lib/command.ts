import camelcaseKeys from 'camelcase-keys';

import {
  GenericObject,
  SaffronHandlerOptions,
  SaffronOptions
} from 'etc/types';
import loadConfiguration from 'lib/configuration';
import ow from 'lib/ow';
import { getPackageInfo } from 'lib/package';
import yargs from 'lib/yargs';

import type { Argv, ArgumentsCamelCase } from 'yargs';


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
  ow(options.aliases, 'aliases', ow.any(ow.undefined, ow.string, ow.array.ofType(ow.string)));


  // ----- Get Package Info ----------------------------------------------------

  const hostPkg = getPackageInfo('host');


  // ----- Builder Proxy -------------------------------------------------------

  /**
   * This function wraps the "builder" function provided to Yargs, setting
   * default behaviors and passing any configuration loaded from cosmiconfig.
   */
  const builder = (command: Argv<any>): Argv<A> => {
    // Set strict mode unless otherwise indicated.
    if (options.strict !== false) {
      command.strict();
    }

    // Apply defaults for the command.
    command.showHelpOnFail(true, 'See --help for usage instructions.');
    command.wrap(yargs.terminalWidth());
    command.alias('v', 'version');
    command.alias('h', 'help');

    if (hostPkg.json?.version) {
      command.version(hostPkg.json.version);
    }

    command.help();

    // Call user-provided builder, additionally passing the (possible)
    // configuration file data we loaded.
    if (options.builder) {
      options.builder({
        command,
        pkg: {
          json: hostPkg.json,
          root: hostPkg.root
        }
      });
    }

    return command;
  };


  // ----- Handler Proxy -------------------------------------------------------

  /**
   * This function wraps the "handler" function provided to Yargs, allowing us
   * to provide several additional data to command handlers. We also ensure
   * that process.exit() is called when an (otherwise uncaught) error is thrown,
   * avoiding UncaughtPromiseRejection errors.
   */
  const handler = async (argv: ArgumentsCamelCase<A>) => {
    const handlerOpts: Partial<SaffronHandlerOptions<A, C>> = {};

    // Convert raw `argv` to camelCase.
    handlerOpts.argv = camelcaseKeys<any, any>(argv, {deep: true});

    handlerOpts.pkg = {
      json: hostPkg.json,
      root: hostPkg.root
    };

    // Whether we should automatically call command.config() with the data
    // from the configuration file.
    let autoConfig = false;

    if (options.config !== false) {
      // If the user did not disable configuration file loading entirely,
      // switch autoConfig to `true` unless they explicitly set the `auto`
      // option to `false`.
      autoConfig = options.config?.auto !== false;

      const configResult = await loadConfiguration<C>({
        // By default, use the un-scoped portion of the package's name as the
        // configuration file name.
        fileName: hostPkg.json?.name ? hostPkg.json.name.split('/').slice(-1)[0] : undefined,
        // N.B. If the user provided a custom fileName, it will overwrite the
        // one from package.json above.
        ...options.config
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
      await options.handler(handlerOpts as Required<SaffronHandlerOptions<A, C>>);
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
    command: options.command ?? '*',
    describe: options?.description ?? hostPkg.json?.description ?? undefined,
    aliases: options.aliases,
    builder,
    handler
  });
}
