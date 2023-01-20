import path from 'path';

import { cosmiconfig } from 'cosmiconfig';
import merge, { } from 'deepmerge';
import fs from 'fs-extra';
import { packageDirectory } from 'pkg-dir';
import resolvePkg from 'resolve-pkg';

import { SaffronCosmiconfigOptions, SaffronCosmiconfigResult } from 'etc/types';
import validators from 'etc/validators';
import log from 'lib/log';
// import TypeScriptLoader from 'lib/typescript-loader';


/**
 * @private
 *
 * Creates a temporary module in the nearest node_modules folder that loads
 * tsconfig-paths and ts-node, executes the provided contents, and returns the
 * result. The node_modules folder is used to ensure the nearest configuration
 * file is loaded.
 */
async function withTsNode(cwd: string, contents: string) {
  const pkgDir = await packageDirectory({ cwd: path.dirname(cwd) });
  if (!pkgDir) throw new Error('[withTsNode] Unable to compute package directory.');

  const tsConfigPathsPath = resolvePkg('tsconfig-paths');
  const tsNodePath = resolvePkg('ts-node');

  const wrapper = `
    require('${tsConfigPathsPath}/register');
    require('${tsNodePath}').register({ esm: true });
    ${contents}
  `;

  const tempDir = path.resolve(pkgDir, 'node_modules');
  const loaderPath = path.resolve(tempDir, '.saffron-loader.js');
  await fs.ensureDir(tempDir);
  await fs.writeFile(loaderPath, wrapper);
  const result = await import(loaderPath);
  void fs.remove(loaderPath);
  return result;
}


/**
 * Cosmiconfig custom loader that supports ESM syntax. It allows host
 * applications to be written in ESM or CJS, and for the consumers of those
 * applications to write configuration files as ESM or CJS.
 */
async function configurationLoader(filePath: string) {
  try {
    const config = await withTsNode(filePath, `
      module.exports = import("${filePath}?nonce=1").then(result => {
        return result?.default ? result.default : result;
      });
    `);
    log.verbose(log.prefix('parseConfiguration'), log.chalk.green.bold('Loaded configuration using ts-node + import().'));
    return config?.default ?? config;
  } catch (err: any) {
    log.error(
      log.prefix('parseConfiguration'),
      'Failed to load configuration file with ts-node + import():',
      err.message
    );
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
export default async function loadConfiguration<C>(options: SaffronCosmiconfigOptions) {
  const { fileName, key, searchFrom, ...cosmicOptions } = validators.cosmiconfigOptions(options);

  const configResult = await cosmiconfig(fileName, merge({
    loaders: {
      // [Aug 2022] This loader is not working at the moment.
      // '.ts': TypeScriptLoader,
      '.ts': configurationLoader,
      '.js': configurationLoader,
      '.mjs': configurationLoader,
      '.cjs': configurationLoader
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
