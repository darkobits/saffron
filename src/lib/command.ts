import camelcaseKeys from 'camelcase-keys';

import {
  SaffronHandlerContext,
  SaffronCommand
} from 'etc/types';
import validators from 'etc/validators';
import loadConfiguration from 'lib/configuration';
import log from 'lib/log';
import { getPackageInfo } from 'lib/package';
import yargs from 'lib/yargs';

import type { Argv, ArgumentsCamelCase } from 'yargs';


type ParsedPackageName<T> = T extends string
  ? { scope?: string; name: string }
  : { scope: never; name: never };

/**
 * @private
 *
 * TODO: Move to own package.
 */
function parsePackageName<T = any>(packageName: T) {
  if (typeof packageName !== 'string') {
    return { scope: undefined, name: undefined } as ParsedPackageName<T>;
  }

  const [scope, name] = packageName.replace('@', '').split('/');
  return { scope, name } as ParsedPackageName<T>;
}


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
  validators.saffronCommand(saffronCommand);

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

    // Set name and version based on the host application's metadata.
    // N.B. Description is set below.
    if (hostPkg.json?.name) yargsCommand.scriptName(parsePackageName(hostPkg.json?.name).name);
    if (hostPkg.json?.version) yargsCommand.version(hostPkg.json.version);

    // Enable --help for this command.
    yargsCommand.help();

    // Call user-provided builder, additionally passing the (possible)
    // configuration file data we loaded.
    if (typeof saffronCommand.builder === 'function') {
      saffronCommand.builder({
        command: yargsCommand,
        pkg: hostPkg
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
    const context: Partial<SaffronHandlerContext<A, C>> = {};

    // Convert raw `argv` to camelCase.
    context.argv = camelcaseKeys<any, any>(argv, { deep: true });

    context.pkg = hostPkg;

    // Whether we should automatically call command.config() with the data
    // from the configuration file.

    if (saffronCommand.config !== false) {
      // Enable auto-configuration unless the user explicitly set the `auto`
      // option to `false`.
      const autoConfig = saffronCommand.config?.auto !== false;

      // If the user provided an explicit file name, use it. Otherwise, use the
      // non-scope portion of the name from the host application's package.json.
      const fileName = saffronCommand.config?.fileName ?? parsePackageName(hostPkg.json?.name).name;

      const configResult = await loadConfiguration<C>({
        fileName,
        // N.B. If the user provided a custom fileName, it will overwrite the
        // one from package.json above.
        ...saffronCommand.config
      });

      if (configResult) {
        if (configResult.config) {
          context.config = camelcaseKeys<any, any>(configResult.config, { deep: true });
        }

        context.configPath = configResult.filepath;
        context.configIsEmpty = Boolean(configResult.isEmpty);

        // If `autoConfig` is enabled, for each key in `argv`, set its value to
        // the corresponding value from `config`, if it exists.
        if (autoConfig && !context.configIsEmpty) {
          if (typeof configResult.config === 'object') {
            Object.entries(configResult.config).forEach(([key, value]) => {
              if (context.argv && context.config && Reflect.has(context.argv, key)) {
                Reflect.set(context.argv, key, value);
              }
            });
          } else {
            log.warn(log.prefix('loadConfiguration'), `Cannot merge configuration of type "${typeof configResult.config}" with arguments.`);
          }
        }
      }
    }

    try {
      // Finally, invoke the user's handler.
      await saffronCommand.handler(context as Required<SaffronHandlerContext<A, C>>);
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
