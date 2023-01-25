import path from 'path';

import fs from 'fs-extra';
import { packageDirectory } from 'pkg-dir';
import resolvePkg from 'resolve-pkg';

import log from 'lib/log';


/**
 * @private
 *
 * Creates a temporary module in the nearest node_modules folder that loads
 * ts-node and tsconfig-paths, then loads the provided configuration file, and
 * returns the results.
 */
async function withTsNode(filePath: string) {
  const pkgDir = await packageDirectory({
    cwd: path.dirname(filePath)
  });

  if (!pkgDir) throw new Error('[withTsNode] Unable to compute package directory.');

  const tsNodePath = resolvePkg('ts-node');
  const tsConfigPathsPath = resolvePkg('tsconfig-paths');

  const wrapper = `
    require('${tsNodePath}').register({
      transpileOnly: true,
      compilerOptions: {
        module: 'commonjs'
      }
    });

    require('${tsConfigPathsPath}/register');

    const config = require("${filePath}");
    module.exports = config.default ?? config;
  `;

  const tempDir = path.resolve(pkgDir, 'node_modules', '.saffron-config');
  await fs.ensureDir(tempDir);
  const loaderPath = path.resolve(tempDir, 'loader.js');
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
export default async function configurationLoader(filePath: string) {
  try {
    const config = await withTsNode(filePath);
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
