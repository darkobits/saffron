// @ts-expect-error - No type declarations for this package.
import babelRegister, { revert } from '@babel/register';
import { cosmiconfig } from 'cosmiconfig';
import merge, { } from 'deepmerge';
import esm from 'esm';
import ow from 'ow';

import { SaffronCosmiconfigOptions, SaffronCosmiconfigResult } from 'etc/types';
import log from 'lib/log';


/**
 * Cosmiconfig custom loader that supports ESM syntax and any Babel plugins that
 * may be installed in the local project.
 */
async function parseConfiguration(filepath: string) {
  // Load bare configuration. This will be used as a backup if the below methods
  // fail.
  if (typeof require === 'function') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const config = require(filepath);
      log.verbose(log.prefix('parseConfiguration'), 'Loaded configuration using require().');
      return config?.default ? config.default : config;
    } catch (err) {
      log.silly(log.prefix('parseConfiguration'), log.chalk.red.bold('Failed to load configuration file using require():'), err.message);
    }
  }

  try {
    const config = await import(filepath);
    log.verbose(log.prefix('parseConfiguration'), 'Loaded configuration using import().');
    return config?.default ? config.default : config;
  } catch (err) {
    log.silly(log.prefix('parseConfiguration'), log.chalk.red.bold('Failed to load configuration file using import():'), err.message);
  }


  // Try to load configuration using 'esm'.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requireEsm = esm(module, { cjs: true });
    const config = requireEsm(filepath);
    log.verbose(log.prefix('parseConfiguration'), 'Loaded configuration using `esm`.');
    return config?.default ? config.default : config;
  } catch (err) {
    log.silly(log.prefix('parseConfiguration'), log.chalk.red.bold('Failed to load configuration with `esm`:'), err.message);
  }

  // Try to load configuration using @babel/register and the host project's
  // Babel configuration. This will be necessary if the configuration file or
  // anything it imports uses Babel features.
  babelRegister({ extensions: ['.ts', '.js', '.mjs', '.cjs', '.json'] });

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require(filepath);
    log.verbose(log.prefix('parseConfiguration'), 'Loaded configuration using @babel/register + require().');
    return config?.default ? config.default : config;
  } catch (err) {
    log.silly(log.prefix('parseConfiguration'), log.chalk.red.bold('Failed to load configuration file with @babel/register + require():'), err.message);
    revert();
  }

  try {
    const config = await import(filepath);
    log.verbose(log.prefix('parseConfiguration'), 'Loaded configuration using @babel/register + import().');
    return config?.default ? config.default : config;
  } catch (err) {
    log.silly(log.prefix('parseConfiguration'), log.chalk.red.bold('Failed to load configuration file with @babel/register + import():'), err.message);
    revert();
  }
}


/**
 * Loads configuration from a configuration file using cosmiconfig. Supports
 * optional sub-key traversal.
 *
 * Note: Cosmiconfig caches every file it loads, so if multiple commands are
 * registered that use the same file, we don't have to worry about multiple
 * filesystem calls here.
 */
export default async function loadConfiguration<C>({ fileName, key, searchFrom, ...cosmicOptions }: SaffronCosmiconfigOptions) {
  // Validate options.
  ow(fileName, 'fileName', ow.string.nonEmpty);
  ow(key, 'key', ow.optional.string);

  const configResult = await cosmiconfig(fileName, merge({
    loaders: {
      '.ts': parseConfiguration,
      '.js': parseConfiguration,
      '.mjs': parseConfiguration,
      '.cjs': parseConfiguration
    },
    searchPlaces: [
      'package.json',
      `.${fileName}.json`,
      `.${fileName}.yaml`,
      `.${fileName}.yml`,
      `.${fileName}rc`,
      `${fileName}.config.ts`,
      `${fileName}.config.js`,
      `${fileName}.config.cjs`,
      `${fileName}.config.mjs`,
      `${fileName}rc.ts`,
      `${fileName}rc.js`,
      `${fileName}rc.cjs`,
      `${fileName}rc.mjs`
    ]
  }, cosmicOptions, {
    arrayMerge: (target, source) => {
      // When merging arrays (like searchPlaces) prepend the user's value to
      // our value.
      return [...source, ...target];
    }
  })).search(searchFrom);

  // If we loaded a non-empty file and the user specified a sub-key that they
  // want to drill-down into, ensure that the root configuration object has that
  // key. If it doesn't, delete the 'config' property on our result and set
  // 'isEmpty' to true. Otherwise, hoist the desired sub-key up to the root of
  // the result.
  if (configResult && !configResult.isEmpty && key) {
    if (!Reflect.has(configResult.config, key)) {
      Reflect.deleteProperty(configResult, 'config');
      configResult.isEmpty = true;
    } else {
      configResult.config = configResult.config[key];
    }
  }

  return configResult as SaffronCosmiconfigResult<C>;
}
