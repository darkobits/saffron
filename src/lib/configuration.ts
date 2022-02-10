import path from 'path';

import { cosmiconfig } from 'cosmiconfig';
import merge, { } from 'deepmerge';
import fs from 'fs-extra';
import { packageDirectory } from 'pkg-dir';
import resolvePkg from 'resolve-pkg';


import { SaffronCosmiconfigOptions, SaffronCosmiconfigResult } from 'etc/types';
import log from 'lib/log';
import ow from 'lib/ow';


/**
 * @private
 *
 * Creates a temporary module in the nearest node_modules folder that loads
 * @babel/register, executes the provided contents, and returns the result. The
 * node_modules folder is used to ensure Babel loads the nearest configuration
 * file.
 */
async function withBabelRegister(configPath: string, contents: string) {
  const pkgDir = await packageDirectory({ cwd: path.dirname(configPath) });
  const babelRegisterPath = resolvePkg('@babel/register');
  const wrapper = `
    const babelRegister = require('${babelRegisterPath}');
    babelRegister({ extensions: ['.ts', '.js', '.mjs', '.cjs', '.json'] });
    ${contents}
  `;

  const tempDir = path.resolve(pkgDir, 'node_modules');
  const loaderPath = path.resolve(tempDir, '.loader.js');
  await fs.ensureDir(tempDir);
  await fs.writeFile(loaderPath, wrapper);
  const result = await import(loaderPath);
  await fs.remove(loaderPath);
  return result;
}


/**
 * Cosmiconfig custom loader that supports ESM syntax and any Babel plugins that
 * may be installed in the local project. This function attempts 6 different
 * parsing strategies in sequence that should cover cases where we are in a CJS
 * context trying to load an ESM configuration file and vice versa.
 */
async function parseConfiguration(filepath: string) {
  const errorThunks: Array<() => void> = [];
  let lastErrorMessage: string;


  // ----- Dynamic Import ------------------------------------------------------

  // N.B. This strategy is disabled because when it fails, Node will issue a
  // warning that is difficult to suppress.
  // try {
  //   const config = await import(`${filepath}?nonce=1`);
  //   log.verbose(log.prefix('parseConfiguration'), log.chalk.green.bold('Loaded configuration using import().'));
  //   return config?.default ? config.default : config;
  // } catch (err: any) {
  //   errorThunks.push(
  //     () => log.silly(
  //       log.prefix('parseConfiguration'),
  //       log.chalk.red.bold('Failed to load configuration file using import():'),
  //       err.message
  //     )
  //   );
  //   lastErrorMessage = err.message;
  // }


  // ----- Babel Register + Dynamic Import -------------------------------------

  // This strategy will work when we are in a CJS or ESM context trying to load
  // an ESM configuration file that uses (or requires files that use) certain
  // Babel features or path mappings that are configured by the local project's
  // Babel configuration file.
  try {
    const config = await withBabelRegister(filepath, `
      module.exports = import("${filepath}?nonce=2").then(result => {
        return result?.default ? result.default : result;
      });
    `);
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
    lastErrorMessage = err.message;
  }


  // ----- Error Reporting -----------------------------------------------------

  if (errorThunks.length > 0) {
    errorThunks.forEach(errorThunk => errorThunk());
  }

  if (lastErrorMessage) {
    throw new Error(`Error parsing configuration file: ${lastErrorMessage}`);
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
