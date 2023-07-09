import path from 'path';

import fs from 'fs-extra';
import resolvePkg from 'resolve-pkg';
import * as tsConfck from 'tsconfck';

import log from 'lib/log';

import type { PackageInfo } from 'lib/package';


/**
 * Creates a temporary module in the nearest node_modules folder that loads
 * @babel/register, then loads the provided configuration file, and returns the
 * results.
 */
export async function babelRegisterStrategy(filePath: string, pkgInfo: PackageInfo) {
  const prefix = log.prefix('strategy:babel-register');

  try {
    if (!pkgInfo.root) throw new Error('Unable to determine host package root directory.');

    const babelRegisterPath = resolvePkg('@babel/register', { cwd: pkgInfo.root });
    if (!babelRegisterPath) throw new Error('Unable to resolve path to @babel/register.');

    const babelPresetEnvPath = resolvePkg('@babel/preset-env', { cwd: pkgInfo.root });
    if (!babelPresetEnvPath) throw new Error('Unable to resolve path to @babel/preset-env.');

    const babelPresetTypeScriptPath = resolvePkg('@babel/preset-typescript', { cwd: pkgInfo.root });
    if (!babelPresetTypeScriptPath) throw new Error('Unable to resolve path to @babel/preset-typescript.');

    const babelPluginModuleResolverTsConfigPath = resolvePkg('babel-plugin-module-resolver-tsconfig', { cwd: pkgInfo.root });
    if (!babelPluginModuleResolverTsConfigPath) throw new Error('Unable to resolve path to babel-plugin-module-resolver-tsconfig.');

    const tsConfigFilePath = await tsConfck.find(filePath);

    const wrapperWithTsConfig = `
      const { setModuleResolverPluginForTsConfig } = require('${babelPluginModuleResolverTsConfigPath}');

      const extensions =  ['.ts', '.tsx', '.js', '.jsx', '.cts', '.cjs', '.mjs', '.mts'];

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
            tsconfigPath: '${tsConfigFilePath}',
            extensions
          })
        ]
      });

      const configExport = require('${filePath}');
      module.exports = configExport.default ?? configExport;
    `;

    const wrapperWithoutTsConfig = `
      const extensions =  ['.ts', '.tsx', '.js', '.jsx', '.cts', '.cjs', '.mjs', '.mts'];

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
          }]
        ]
      });

      const configExport = require('${filePath}');
      module.exports = configExport.default ?? configExport;
    `;

    if (tsConfigFilePath) {
      log.silly(prefix, `Loaded tsconfig.json from: ${log.chalk.green(tsConfigFilePath)}`);
    }

    const tempDir = path.resolve(pkgInfo.root, 'node_modules', '.saffron-config');
    await fs.ensureDir(tempDir);
    const loaderPath = path.resolve(tempDir, 'loader.cjs');
    await fs.writeFile(
      loaderPath,
      tsConfigFilePath
        ? wrapperWithTsConfig
        : wrapperWithoutTsConfig
    );
    const result = await import(loaderPath);
    await fs.remove(tempDir);

    return result.default ?? result;
  } catch (err: any) {
    throw new Error(
      `${log.chalk.red(`[${prefix}] Failed to import() configuration file ${filePath}:`)} ${err.message}`,
      { cause: err }
    );
  }
}
