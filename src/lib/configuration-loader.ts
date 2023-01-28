import path from 'path';

import AggregateError from 'aggregate-error';
import fs from 'fs-extra';
import packageDirectory from 'pkg-dir';
import resolvePkg from 'resolve-pkg';

import log from 'lib/log';


/**
 * @private
 *
 * Creates a temporary module in the nearest node_modules folder that loads
 * ts-node and tsconfig-paths, then loads the provided configuration file, and
 * returns the results.
 */
async function withTsNode(pkgDir: string, filePath: string) {
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
  await fs.remove(tempDir);

  log.verbose(log.prefix('parseConfiguration'), log.chalk.green.bold('Loaded configuration using ts-node.'));

  return result;
}


/**
 * @private
 *
 * Creates a temporary module in the nearest node_modules folder that loads
 * ts-node and tsconfig-paths, then loads the provided configuration file, and
 * returns the results.
 */
async function withBabel(pkgDir: string, filePath: string) {
  const babelRegisterPath = resolvePkg('@babel/register');

  const wrapper = `
    require('${babelRegisterPath}')({
      extensions: ['.ts', '.js', '.cjs']
    });

    const config = require("${filePath}");
    module.exports = config.default ?? config;
  `;

  const tempDir = path.resolve(pkgDir, 'node_modules', '.saffron-config');
  await fs.ensureDir(tempDir);
  const loaderPath = path.resolve(tempDir, 'loader.js');
  await fs.writeFile(loaderPath, wrapper);
  const result = await import(loaderPath);
  await fs.remove(tempDir);

  log.verbose(log.prefix('parseConfiguration'), log.chalk.green.bold('Loaded configuration using @babel/register.'));

  return result;
}


/**
 * Cosmiconfig custom loader that supports ESM syntax. It allows host
 * applications to be written in ESM or CJS, and for the consumers of those
 * applications to write configuration files as ESM or CJS.
 */
export default async function configurationLoader(filePath: string) {
  const errors: Array<Error> = [];

  const pkgDir = await packageDirectory(path.dirname(filePath));

  if (!pkgDir) throw new Error(`${log.prefix('parseConfiguration')} Unable to compute package directory.`);

  try {
    const config = await withTsNode(pkgDir, filePath);
    return config?.default ?? config;
  } catch (err: any) {
    errors.push(new Error(`${log.prefix('parseConfiguration')} Failed to load configuration with ts-node: ${err}`));
  }

  try {
    const config = await withBabel(pkgDir, filePath);
    return config?.default ?? config;
  } catch (err: any) {
    errors.push(new Error(`${log.prefix('parseConfiguration')} Failed to load configuration with @babel/register: ${err}`));
  }

  if (errors.length > 0) {
    throw new AggregateError(errors);
  }
}
