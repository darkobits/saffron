import path from 'path';

import { dirname } from '@darkobits/fd-name';
import AggregateError from 'aggregate-error';
import merge from 'deepmerge';
import findUp from 'find-up';
import fs from 'fs-extra';
import packageDirectory from 'pkg-dir';
import resolvePkg from 'resolve-pkg';
import * as tsImport from 'ts-import';
import {
  register,
  type RegisterOptions
} from 'ts-node';
import { loadConfigFromFile } from 'vite';

import log from 'lib/log';

import type { Loader } from 'cosmiconfig';


async function withViteLoader(configRoot: string, configFile: string) {
  const result = await loadConfigFromFile(
    {
      command: 'build',
      mode: 'development'
    },
    configFile, // configFile?: string,
    configRoot // configRoot: string = process.cwd(),
    // logLevel?: LogLevel
  );

  // @ts-expect-error
  return result?.config?.default ?? result?.config;
}


/**
 * @private
 *
 * Computes the extension we should use for the temporary (re: transpiled)
 * configuration file.
 */
function computeFileExtension(fileName: string) {
  const parsedFileName = path.parse(fileName);
  Reflect.deleteProperty(parsedFileName, 'base');

  switch (parsedFileName.ext) {
    case '.ts':
      parsedFileName.ext = '.js';
      break;
    case '.cts':
      parsedFileName.ext = '.cjs';
      break;
    case '.mts':
      parsedFileName.ext = '.mjs';
      break;
  }

  return path.format(parsedFileName);
}


/**
 * @private
 *
 * Convoluted way to dynamically transpile and import() TypeScript files at
 * runtime.
 */
function TypeScriptLoader(options: RegisterOptions = {}) {
  const ourDirname = dirname();
  if (!ourDirname) throw new Error('Unable to determine local directory.');

  const tsConfigPathsRegisterPath = resolvePkg('tsconfig-paths/register', { cwd: ourDirname });
  if (!tsConfigPathsRegisterPath) throw new Error('Unable to resolve path to tsconfig-paths/register.');

  // N.B. Signature for Cosmiconfig loaders.
  return async (configFilePath: string, content: string) => {
    let tempConfigFilePath = '';

    try {
      // ----- [1] Prepare ts-node Instance ------------------------------------

      const { ext } = path.parse(configFilePath);

      // What we are really testing for here is whether the user has
      // _explicitly_ requested that the configuration file be parsed as CJS
      // despite what their package.json / tsconfig.json may indicate for the
      // rest of the project. In other cases, we may still parse the
      // configuration file as CJS, but we will not need to use the overrides
      // triggered by this flag.
      const isExplicitCommonJs = ['.cjs', '.cts'].includes(ext);

      const ourOptions: RegisterOptions = {
        require: [tsConfigPathsRegisterPath]
      };

      if (isExplicitCommonJs) {
        ourOptions.compilerOptions = {
          module: 'NodeNext',
          moduleResolution: 'Node16'
        };
      }

      const finalOptions = merge(options ?? {}, ourOptions);
      log.silly(log.prefix('TypeScriptLoader'), 'ts-node options', finalOptions);
      const tsNodeInstance = register(finalOptions);


      // ----- [2] Compute Path for Temporary Configuration File ---------------

      const tempConfigFileName = computeFileExtension(`.saffron-temporary-${path.basename(configFilePath)}`);
      const tempConfigFileDirectory = path.dirname(configFilePath);
      tempConfigFilePath = path.join(tempConfigFileDirectory, tempConfigFileName);


      // ----- [3] Transpile Configuration File --------------------------------

      // N.B. Not clear why ts-node (or possibly by extension, TypeScript) needs
      // both a file name _and_ its contents here.
      let transpiledConfig = tsNodeInstance.compile(content, configFilePath);


      // ----- [4] Clean Transpiled Configuration File -------------------------

      // Remove empty export declarations added by ts-node, which will sometimes
      // be added even if we are transpiling to CommonJS where such declarations
      // are illegal.
      if (isExplicitCommonJs) {
        transpiledConfig = transpiledConfig.replaceAll(/export\s+{\s?};?/g, '');
      }


      // ----- [5] Write and Import Transpiled Configuration File --------------

      if (isExplicitCommonJs) {
        log.verbose(log.prefix('TypeScriptLoader'), log.chalk.yellow('Used overrides for explicit CommonJS.'));
      }

      await fs.writeFile(tempConfigFilePath, transpiledConfig);
      const result = await import(tempConfigFilePath);

      log.verbose('Loaded configuration using TypeScript loader.');

      // `default` is used when exporting using export default, some modules
      // may still use `module.exports` or if in TS `export = `
      return (result.default || result) as Loader;
    } finally {
      if (tempConfigFilePath.length > 0) {
        await fs.remove(tempConfigFilePath);
        log.silly(log.prefix('TypeScriptLoader'), `Removed temporary file: ${log.chalk.green(tempConfigFilePath)}`);
      }
    }
  };
}


/**
 * @private
 *
 * Uses ts-import to dynamically import TypeScript configuration files.
 */
async function withTsImport(filePath: string) {
  const result = await tsImport.load(filePath, {
    // Slower, but allows files to be considered as part of larger TypeScript
    // programs, which should allow path mappings to work.
    mode: tsImport.LoadMode.Compile,
    // N.B. Even with this set to false, ts-import still seems to create (and
    // leave behind) a .cache directory.
    useCache: false
  });

  // Clean-up the cache directory left behind by ts-import.
  try {
    await fs.remove(path.join(path.dirname(filePath), '.cache'));
  } catch (err: any) {
    log.error(log.prefix('ts-import'), 'Error removing cache directory:', err);
  }

  return result?.default || result;
}


/**
 * @private
 *
 * Creates a temporary module in the nearest node_modules folder that loads
 * @babel/register, then loads the provided configuration file, and returns the
 * results.
 */
async function withBabelRegister(pkgDir: string, filePath: string) {
  try {
    const ourDirname = dirname();
    if (!ourDirname) throw new Error('Unable to determine local directory.');

    const babelRegisterPath = resolvePkg('@babel/register', { cwd: ourDirname });
    if (!babelRegisterPath) throw new Error('Unable to resolve path to @babel/register.');

    const babelPresetEnvPath = resolvePkg('@babel/preset-env', { cwd: ourDirname });
    if (!babelPresetEnvPath) throw new Error('Unable to resolve path to @babel/preset-env.');

    const babelPresetTypeScriptPath = resolvePkg('@babel/preset-typescript', { cwd: ourDirname });
    if (!babelPresetTypeScriptPath) throw new Error('Unable to resolve path to @babel/preset-typescript.');

    const babelPluginModuleResolverTsConfigPath = resolvePkg('babel-plugin-module-resolver-tsconfig', { cwd: ourDirname });
    if (!babelPluginModuleResolverTsConfigPath) throw new Error('Unable to resolve path to babel-plugin-module-resolver-tsconfig.');

    const tsConfigPath = await findUp('tsconfig.json', { cwd: pkgDir });
    if (!tsConfigPath) throw new Error('[withBabelRegister] Could not find tsconfig.json.');

    const wrapper = `
      const { setModuleResolverPluginForTsConfig } = require('${babelPluginModuleResolverTsConfigPath}');

      const extensions =  ['.ts', '.tsx', '.js', '.jsx', '.cts', '.cjs', '.mjs'];

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

    log.verbose(log.prefix('parseConfiguration'), `Loaded configuration with ${log.chalk.bold('@babel/register')}.`, result);

    return result.default ?? result;
  } catch (err) {
    throw new Error(`${log.prefix('parseConfiguration')} Failed to load configuration with ${log.chalk.bold('@babel/register')}: ${err}`);
  }
}


/**
 * Cosmiconfig custom loader that supports ESM syntax. It allows host
 * applications to be written in ESM or CJS, and for the consumers of those
 * applications to write configuration files as ESM or CJS.
 */
export default async function configurationLoader(filePath: string, contents: string) {
  const errors: Array<Error> = [];

  const pkgDir = await packageDirectory(path.dirname(filePath));
  if (!pkgDir) throw new Error(`${log.prefix('configurationLoader')} Unable to compute package directory.`);


  /**
   * Strategy 0: Use Vite's configuration loader.
   */
  try {
    const config = await withViteLoader(pkgDir, filePath);
    log.verbose(log.prefix('configurationLoader'), 'Used strategy:', log.chalk.bold('vite'));
    return config.default ?? config;
  } catch (err: any) {
    errors.push(new Error(`${log.prefix('configurationLoader')} Failed to load configuration with ${log.chalk.bold('Vite')}: ${err}`));
  }

  /**
   * Strategy 1: Vanilla Dynamic Import
   *
   * This will not perform any transpilation on code, and if the host project
   * uses any custom path mappings, they will not work here. This strategy is
   * the simplest, however, so we try it first.
   */
  try {
    const config = await import(filePath);
    log.verbose(log.prefix('configurationLoader'), 'Used strategy:', log.chalk.bold('import()'));
    return config?.default ?? config;
  } catch (err: any) {
    errors.push(new Error(`${log.prefix('configurationLoader')} Failed to load configuration with ${log.chalk.bold('dynamic import')}: ${err}`));
  }


  /**
   * Strategy 2: ts-import
   */
  try {
    const config = await withTsImport(filePath);
    log.verbose(log.prefix('configurationLoader'), 'Used strategy:', log.chalk.bold('ts-import'));
    return config?.default ?? config;
  } catch (err: any) {
    errors.push(new Error(`${log.prefix('configurationLoader')} Failed to load configuration with ${log.chalk.bold('ts-import')}: ${err}`));
  }


  /**
   * Strategy 3: ts-node
   *
   * This strategy is in place in the event that @babel/register did not work
   * for some reason, but it is not ideal for reasons explained above.
   */
  try {
    const tsLoader = TypeScriptLoader();
    const config = await tsLoader(filePath, contents);
    log.verbose(log.prefix('configurationLoader'), 'Used strategy:', log.chalk.bold('ts-node'));
    return config;
  } catch (err: any) {
    errors.push(new Error(`${log.prefix('configurationLoader')} Failed to load configuration with ${log.chalk.bold('TypeScriptLoader')}: ${err}`));
  }


  /**
   * Strategy 4: @babel/register
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
    log.verbose(log.prefix('configurationLoader'), 'Used strategy:', log.chalk.bold('@babel/register'));
    return config?.default ?? config;
  } catch (err: any) {
    errors.push(err);
  }


  if (errors.length > 0) {
    throw new AggregateError(errors);
  }
}
