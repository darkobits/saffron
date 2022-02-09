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
 * may be installed in the local project. This function attempts 6 different
 * parsing strategies in sequence that should cover cases where we are in a CJS
 * context trying to load an ESM configuration file and vice versa, as well as
 *
 */
async function parseConfiguration(filepath: string) {
  const errorThunks: Array<() => void> = [];
  const errorMessages = new Set<string>();

  // ----- 1: CommonJs Require -------------------------------------------------

  // This strategy will work if we are in a CJS context trying to load a CJS
  // configuration file.
  if (typeof require === 'function') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const config = require(filepath);
      log.verbose(log.prefix('parseConfiguration'), log.chalk.green.bold('Loaded configuration using require().'));
      return config?.default ? config.default : config;
    } catch (err: any) {
      errorThunks.push(
        () => log.silly(
          log.prefix('parseConfiguration'),
          log.chalk.red.bold('Failed to load configuration file using require():'),
          err.message
        )
      );
      errorMessages.add(err.message);
    }
  }


  // ----- 2: Dynamic Import ---------------------------------------------------

  // This strategy will work if we are in a CJS or ESM context trying to load an
  // ESM configuration file.
  try {
    const config = await import(filepath);
    log.verbose(log.prefix('parseConfiguration'), log.chalk.green.bold('Loaded configuration using import().'));
    return config?.default ? config.default : config;
  } catch (err: any) {
    errorThunks.push(
      () => log.silly(
        log.prefix('parseConfiguration'),
        log.chalk.red.bold('Failed to load configuration file using import():'),
        err.message
      )
    );
    errorMessages.add(err.message);
  }


  // ----- 3: ESM --------------------------------------------------------------

  // This strategy is a fallback to strategy 2 that may work in some cases where
  // dynamic import does not.
  try {
    const requireEsm = esm(module, { cjs: true });
    const config = requireEsm(filepath);
    log.verbose(log.prefix('parseConfiguration'), log.chalk.green.bold('Loaded configuration using `esm`.'));
    return config?.default ? config.default : config;
  } catch (err: any) {
    errorThunks.push(
      () => log.silly(
        log.prefix('parseConfiguration'),
        log.chalk.red.bold('Failed to load configuration with `esm`:'),
        err.message
      )
    );
    errorMessages.add(err.message);
  }

  // Load @babel/register, which will use the host project's Babel
  // configuration. This will be necessary if the configuration file or anything
  // it imports uses Babel features.
  babelRegister({ extensions: ['.ts', '.js', '.mjs', '.cjs', '.json'] });


  // ----- 4: Babel Register + CommonJS Require --------------------------------

  // This strategy will work when we are in a CJS context trying to load a CJS
  // configuration file that uses (or requires files that use) certain Babel
  // features or path mappings that are configured by the local project's Babel
  // configuration file.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require(filepath);
    log.verbose(log.prefix('parseConfiguration'), log.chalk.green.bold('Loaded configuration using @babel/register + require().'));
    return config?.default ? config.default : config;
  } catch (err: any) {
    errorThunks.push(
      () => log.silly(
        log.prefix('parseConfiguration'),
        log.chalk.red.bold('Failed to load configuration file with @babel/register + require():'),
        err.message
      )
    );
    errorMessages.add(err.message);
    revert();
  }


  // ----- 5: Babel Register + Dynamic Import ----------------------------------

  // This strategy will work when we are in a CJS or ESM context trying to load
  // an ESM configuration file that uses (or requires files that use) certain
  // Babel features or path mappings that are configured by the local project's
  // Babel configuration file.
  try {
    const config = await import(filepath);
    log.verbose(log.prefix('parseConfiguration'), log.chalk.green.bold('Loaded configuration using @babel/register + import().'));
    return config?.default ? config.default : config;
  } catch (err: any) {
    errorThunks.push(
      () => log.silly(
        log.prefix('parseConfiguration'),
        log.chalk.red.bold('Failed to load configuration file with @babel/register + import():'),
        err.message
      )
    );
    errorMessages.add(err.message);
    revert();
  }


  // ----- 6: Babel Register + ESM ---------------------------------------------

  // This strategy is a fallback to strategy 5 that may work in cases where
  // dynamic import does not.
  try {
    const requireEsm = esm(module, { cjs: true });
    const config = requireEsm(filepath);
    log.verbose(log.prefix('parseConfiguration'), log.chalk.green.bold('Loaded configuration using @babel/register + `esm`.'));
    return config?.default ? config.default : config;
  } catch (err: any) {
    errorThunks.push(
      () => log.silly(
        log.prefix('parseConfiguration'),
        log.chalk.red.bold('Failed to load configuration with @babel/register + `esm`:'),
        err.message
      )
    );
    errorMessages.add(err.message);
    revert();
  }

  if (errorThunks.length > 0) {
    errorThunks.forEach(errorThunk => errorThunk());
  }

  // If every strategy produced the same error, the issue is a likely a syntax
  // or module resolution issue.
  if (errorMessages.size === 1) {
    const message = [...errorMessages.values()].pop();
    throw new Error(`Error parsing configuration file: ${message}`);
  }

  throw new Error('All configuration parsing strategies failed.');
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

  if (configResult) {
    return configResult as SaffronCosmiconfigResult<C>;
  }
}
