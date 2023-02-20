import path from 'path';

import AggregateError from 'aggregate-error';
import findUp from 'find-up';
import fs from 'fs-extra';
import packageDirectory from 'pkg-dir';
import resolvePkg from 'resolve-pkg';

import log from 'lib/log';


/**
 * @private
 *
 * Creates a temporary module in the nearest node_modules folder that loads
 * @babel/register, then loads the provided configuration file, and returns the
 * results.
 */
async function withBabelRegister(pkgDir: string, filePath: string) {
  try {
    const babelRegisterPath = resolvePkg('@babel/register');
    const babelPresetEnvPath = resolvePkg('@babel/preset-env');
    const babelPresetTypeScriptPath = resolvePkg('@babel/preset-typescript');
    const babelPluginModuleResolverTsConfigPath = resolvePkg('babel-plugin-module-resolver-tsconfig');
    const tsConfigPath = await findUp('tsconfig.json', { cwd: pkgDir });

    if (!tsConfigPath) throw new Error('[withBabelRegister] Could not find tsconfig.json.');

    const wrapper = `
      const { setModuleResolverPluginForTsConfig } = require('${babelPluginModuleResolverTsConfigPath}');

      const extensions =  ['.ts', '.tsx', '.js', '.jsx', '.cts', '.cjs'];

      require('${babelRegisterPath}')({
        extensions,
        // Treat files that contain import statements as modules and require statements as CommonJS.
        sourceType: 'unambiguous',
        // Let's Babel transpile files that may be above process.cwd(), which are ignored when using the
        // default settings.
        // See: https://github.com/babel/babel/issues/8321
        ignore: [/node_modules/],
        // Apply the minimum amount of transforms required to make code compatible with the local Node
        // installation.
        targets: { node: 'current' },
        presets: [
          ['${babelPresetEnvPath}', {
            // Tell Babel to not transpile dynamic import statements into require() calls as this is the
            // mechanism by which CommonJS can import ESM.
            exclude: ['proposal-dynamic-import']
          }],
          '${babelPresetTypeScriptPath}'
        ],
        plugins: [
          // If the project has set up path mappings using tsconfig.json, this plugin will allow those
          // path specifiers to work as expected.
          setModuleResolverPluginForTsConfig({
            tsconfigPath: '${tsConfigPath}',
            extensions
          })
        ]
      });

      const configExport = require('${filePath}');
      module.exports = configExport.default ?? configExport;
    `;

    const tempDir = path.resolve(pkgDir, 'node_modules', '.saffron-config');
    await fs.ensureDir(tempDir);
    const loaderPath = path.resolve(tempDir, 'loader.cjs');
    await fs.writeFile(loaderPath, wrapper);
    const result = await import(loaderPath);
    await fs.remove(tempDir);

    log.verbose(log.prefix('parseConfiguration'), `Loaded configuration with ${log.chalk.bold('@babel/register')}.`);

    return result.default ?? result;
  } catch (err) {
    throw new Error(`${log.prefix('parseConfiguration')} Failed to load configuration with ${log.chalk.bold('@babel/register')}: ${err}`);
  }
}


/**
 * @private
 *
 * Creates a temporary module in the nearest node_modules folder that loads
 * ts-node and tsconfig-paths, then loads the provided configuration file, and
 * returns the results.
 */
async function withTsNode(pkgDir: string, filePath: string) {
  try {
    const tsNodePath = resolvePkg('ts-node');
    const tsConfigPathsPath = resolvePkg('tsconfig-paths');

    const wrapper = `
      require('${tsNodePath}').register({
        transpileOnly: true,
        compilerOptions: {
          // Tell ts-node to always transpile ESM import specifiers to require() calls, as cosmiconfig
          // only supports CommonJS at the moment.
          module: 'commonjs'
        }
      });

      // If the project has set up path mappings using tsconfig.json, this plugin will allow those path
      // specifiers to work as expected.
      require('${tsConfigPathsPath}/register');

      const configExport = require("${filePath}");
      module.exports = configExport.default ?? configExport;
    `;

    const tempDir = path.resolve(pkgDir, 'node_modules', '.saffron-config');
    await fs.ensureDir(tempDir);
    const loaderPath = path.resolve(tempDir, 'loader.js');
    await fs.writeFile(loaderPath, wrapper);
    const result = await import(loaderPath);
    await fs.remove(tempDir);

    log.verbose(log.prefix('parseConfiguration'), `Loaded configuration with ${log.chalk.green.bold('ts-node')}.`);

    return result;
  } catch (err) {
    throw new Error(`${log.prefix('parseConfiguration')} Failed to load configuration with ${log.chalk.bold('ts-node')}: ${err}`);
  }
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

  /**
   * Strategy 1: Vanilla Dynamic Import
   *
   * This will not perform any transpilation on code, and if the host project
   * uses any custom path mappings, they will not work here. This strategy is
   * the simplest, however, so we try it first.
   */
  try {
    const config = await import(filePath);
    return config?.default ?? config;
  } catch (err: any) {
    errors.push(new Error(`${log.prefix('parseConfiguration')} Failed to load configuration with ${log.chalk.bold('dynamic import')}: ${err}`));
  }

  /**
   * Strategy 2: @babel/register
   *
   * This strategy uses a custom loader that uses @babel/register to transpile
   * code. The loader will work with TypeScript configuration files, and it will
   * additionally configure Babel to use path mappings defined in tsconfig.json.
   * The host project need not have a Babel configuration file in place for this
   * strategy to work. If the first strategy failed, this one should work for
   * the majority of cases. We try this before ts-node because TypeScript does
   * not have any mechanism that allows us to preserve dynamic import statements
   * when transpiling to CommonJS.
   */
  try {
    const config = await withBabelRegister(pkgDir, filePath);
    return config?.default ?? config;
  } catch (err: any) {
    errors.push(err);
  }

  /**
   * Strategy 3: ts-node
   *
   * This strategy is in place in the event that @babel/register did not work
   * for some reason, but it is not ideal for reasons explained above.
   */
  try {
    const config = await withTsNode(pkgDir, filePath);
    return config?.default ?? config;
  } catch (err: any) {
    errors.push(err);
  }

  if (errors.length > 0) {
    throw new AggregateError(errors);
  }
}
