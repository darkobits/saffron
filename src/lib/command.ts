import fs from 'fs';
import path from 'path';

import camelcaseKeys from 'camelcase-keys';

import {
  SaffronCommand,
  SaffronCosmiconfigResult,
  SaffronHandlerContext
} from 'etc/types';
import validators from 'etc/validators';
import createLoader from 'lib/configuration/loader';
import log from 'lib/log';
import { getPackageInfo, parsePackageName } from 'lib/package';
import yargs from 'lib/yargs';

import type {
  Argv,
  ArgumentsCamelCase,
  CommandModule
} from 'yargs';


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

  /**
   * Context object that will ultimately be passed to the command's handler. We
   * define this early because we need to modify it from middleware that will
   * run before the handler is called.
   */
  const context: Partial<SaffronHandlerContext<A, C>> = {};

  // Get the application's manifest.
  context.pkg = getPackageInfo({ cwd: path.dirname(fs.realpathSync(process.argv[1])) });


  // ----- Prepare Configuration Loader ----------------------------------------

  const configOptions = saffronCommand.config || {};

  const loader = createLoader<C>({
    fileName: context.pkg?.json?.name
      ? parsePackageName(context.pkg.json.name).name
      : undefined,
    ...configOptions
  });


  // ----- Configuration-Loader Middleware -------------------------------------

  const middleware = async (argv: ArgumentsCamelCase<A>) => {
    // If set to `false`, the application wants to disable all configuration
    // related features.
    if (saffronCommand.config === false) return;

    const configOptions = saffronCommand.config ?? {};

    // Enable auto-configuration unless the user explicitly set the `auto`
    // option to `false`.
    const autoConfig = configOptions.auto !== false;

    let configResult: SaffronCosmiconfigResult<C> | undefined;

    // If the application defined a parameter to use for loading an explicit
    // configuration file, and the user invoked the CLI with that option,
    // then attempt to load a configuration file from that location.
    if (configOptions.explicitConfigFileParam) {
      const explicitConfigFilePath = argv[configOptions.explicitConfigFileParam];
      if (typeof explicitConfigFilePath === 'string') configResult = await loader.load(explicitConfigFilePath);
    }

    // If any of the above conditions were not satisfied and we still don't
    // have a truthy value, attempt to load a configuration file by searching.
    if (!configResult) configResult = await loader.search(configOptions.searchFrom);

    // If we loaded a non-empty file and the user specified a sub-key that
    // they want to drill-down into, ensure that the root configuration object
    // has that key. If it doesn't, delete the 'config' property on our result
    // and set 'isEmpty' to true. Otherwise, hoist the desired sub-key up to
    // the root of the result.
    if (configResult?.config && configOptions.key) {
      if (!Reflect.has(configResult.config, configOptions.key)) {
        Reflect.deleteProperty(configResult, 'config');
        configResult.isEmpty = true;
      } else {
        configResult.config = Reflect.get(configResult.config, configOptions.key) as C;
      }
    }

    if (configResult) {
      if (configResult.config) context.config = camelcaseKeys<any, any>(configResult.config, { deep: true });
      context.configPath = configResult.filepath;
      context.configIsEmpty = Boolean(configResult.isEmpty);

      // If auto-config is enabled, then for each key/value pair in the config
      // object, set the same key/value pair on `argv` if and only if the key
      // does not already exist on `argv`. This ensures that command-line
      // arguments will always supersede configuration options.
      if (autoConfig && !configResult.isEmpty) {
        if (typeof configResult.config === 'object') {
          Object.entries(configResult.config).forEach(([key, value]) => {
            if (!Reflect.has(argv, key)) Reflect.set(argv, key, value);
          });
        } else {
          log.warn(
            log.prefix('handler'),
            `Auto-configuration enabled; expected configuration to be of type "object", got "${typeof configResult.config}".`
          );
        }
      }
    }
  };


  // ----- Builder Proxy -------------------------------------------------------

  /**
   * This function wraps the "builder" function provided to Yargs, setting
   * default behaviors and registering middleware.
   */
  const builder = (yargsCommand: Argv<A>): Argv<A> => {
    // Set strict mode unless explicitly disabled.
    if (saffronCommand.strict !== false) yargsCommand.strict();

    // Apply defaults for the command.
    yargsCommand.showHelpOnFail(true, 'See --help for usage instructions.');
    yargsCommand.wrap(yargsCommand.terminalWidth());
    yargsCommand.alias('v', 'version');
    yargsCommand.alias('h', 'help');

    // Set name and version based on the host application's metadata.
    // N.B. Description is set below.
    if (context.pkg?.json?.name) yargsCommand.scriptName(parsePackageName(context.pkg.json.name).name);
    if (context.pkg?.json?.version) yargsCommand.version(context.pkg.json.version);

    // Enable --help for this command.
    yargsCommand.help();

    // Call user-provided builder, additionally passing the (possible)
    // configuration file data we loaded.
    if (typeof saffronCommand.builder === 'function') {
      saffronCommand.builder({
        command: yargsCommand,
        pkg: context.pkg
      });
    }

    // Register middleware, run before validation occurs.
    yargsCommand.middleware(middleware, true);

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
    // Convert raw `argv` to camelCase.
    context.argv = camelcaseKeys<any, any>(argv, { deep: true });

    try {
      // Invoke the application's handler.
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

  yargs.command({
    command: saffronCommand.command ?? '*',
    describe: saffronCommand.description ?? context.pkg?.json?.description,
    aliases: saffronCommand.aliases,
    builder,
    handler
  } as CommandModule<any, A>);
}
