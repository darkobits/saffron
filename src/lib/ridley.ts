import path from 'path';

import camelcaseKeys from 'camelcase-keys';
import {cosmiconfig, Options as _CosmiconfigOptions} from 'cosmiconfig';
import readPkgUp, {NormalizedReadResult} from 'read-pkg-up';
import R from 'ramda';
import yargs, {Arguments} from 'yargs';

import {RidleyOptions} from 'etc/types';


/**
 * Integration between Yargs and Cosmiconfig.
 *
 * Type Parameters:
 *
 * C = Shape of the command's configuration and arguments, or a union of the two
 *     if they are divergent.
 */
export default async function Ridley<C = any>(options: RidleyOptions<C>) {
  // ----- Read Package Info ---------------------------------------------------

  const packageResult = await readPkgUp();

  let packageJson: NormalizedReadResult['packageJson'] | false = false;

  if (packageResult && packageResult.packageJson) {
    packageJson = packageResult.packageJson;
  }


  // ----- Configure Cosmiconfig -----------------------------------------------

  // Break-out Cosmiconfig options into separate 'moduleName' and 'config'
  // objects, removing extraneous keys.
  let cosmiconfigModuleName = R.pathOr('', ['config', 'moduleName'], options);
  const cosmiconfigOptions = R.omit(['moduleName'], options.config || {});

  // If no 'moduleName' option was provided, attempt to use "name" from the
  // project's package.json.
  if (!cosmiconfigModuleName) {
    if (!packageJson) {
      throw new Error('No "config.moduleName" option provided and no "package.json" found.');
    }

    if (!packageJson.name) {
      throw new Error('No "config.moduleName" option provided and "package.json" does not contain a "name" field.');
    }

    // Use "name" (minus any scope).
    cosmiconfigModuleName = R.last(R.split('/', packageJson.name));
  }

  let searchPlaces: Array<string>;

  if (cosmiconfigOptions.searchPlaces && cosmiconfigOptions.searchPlaces.length > 0) {
    // Use search places from config.
    searchPlaces = cosmiconfigOptions.searchPlaces;
  } else {
    // Create default search places using computed module name.
    searchPlaces = [
      'package.json',
      `.${cosmiconfigModuleName}rc`,
      `.${cosmiconfigModuleName}.json`,
      `.${cosmiconfigModuleName}.yaml`,
      `.${cosmiconfigModuleName}.yml`,
      `${cosmiconfigModuleName}.config.js`,
    ];
  }

  const configResult = await cosmiconfig(cosmiconfigModuleName, {...cosmiconfigOptions, searchPlaces}).search();

  // Use the data from the configuration file to populate Yargs. This lets us
  // have a single path for validation/parsing.
  if (configResult && !configResult.isEmpty) {
    yargs.config(configResult.config);
  }


  // ----- Configure Yargs -----------------------------------------------------

  // Wrap handler.
  const handler = async (argv: Arguments<C>) => {
    try {
      await options.handler({
        argv: camelcaseKeys(argv) as Arguments<C>,
        rawConfig: configResult && configResult.config,
        configPath: configResult ? configResult.filepath : undefined,
        configIsEmpty: configResult ? configResult.isEmpty : undefined,
        packageJson: packageResult ? packageResult.packageJson : undefined,
        packageJsonPath: packageResult ? packageResult.path : undefined,
        packageRoot: packageResult ? path.dirname(packageResult.path) : undefined
      });
    } catch (err) {
      if (err && typeof err.code === 'number') {
        process.exit(err.code);
      } else {
        process.exit(1);
      }
    }
  };

  const defaultYargsOptions = {
    // This is Yargs-speak for "handle the default/root command".
    command: '*',
    // Convert our 'description' option to Yargs' 'describe' option, optionally
    // using the "description" field from package.json if none was provided.
    describe: options.description ? options.description : (packageJson ? packageJson.description : '')
  };

  // Remove keys we don't need/want when configuring Yargs, then merge with our
  // default options.
  const yargsOptions = R.merge(defaultYargsOptions, R.omit(['config', 'description', 'handler'], options));


  // Build command, using our wrapper as the handler.
  yargs.command({...yargsOptions, handler});

  // Apply various other config for Yargs.
  yargs.showHelpOnFail(true, 'See --help for usage instructions.');
  yargs.wrap(yargs.terminalWidth());
  yargs.alias('v', 'version');
  yargs.alias('h', 'help');
  yargs.version();
  yargs.help();

  if (options.strict !== false) {
    yargs.strict();
  }

  // Parse command-line arguments, bail on --help, --version, etc.
  yargs.argv; // tslint:disable-line: no-unused-expression
}
