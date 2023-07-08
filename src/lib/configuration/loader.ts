import path from 'path';

import { cosmiconfig, defaultLoaders } from 'cosmiconfig';
import merge from 'deepmerge';

import validators from 'etc/validators';
import { babelRegisterStrategy } from 'lib/configuration/strategies/babel-register';
import { esbuildStrategy } from 'lib/configuration/strategies/esbuild';
import log from 'lib/log';
import { getPackageInfo } from 'lib/package';

import type {
  SaffronCosmiconfigOptions,
  SaffronCosmiconfigResult
} from 'etc/types';


/**
 * @private
 *
 * Custom Cosmiconfig loader that uses multiple strategies to attempt to load an
 * ECMAScript configuration file. Designed to work with applications written in
 * ESM or CJS, for the consumers of those applications to be written in ESM or
 * CJS, and with configuration files written in ESM or CJS.
 */
async function ecmaScriptLoader(filePath: string /* , content: string */) {
  const prefix = log.prefix('config');
  const errors: Array<Error> = [];

  log.verbose(prefix, `Found configuration file: ${log.chalk.green(filePath)}`);

  const pkgInfo = getPackageInfo({ cwd: path.dirname(filePath) });
  if (!pkgInfo?.root) throw new Error(`${prefix} Unable to compute host package root directory.`);


  /**
   * Strategy 1: Vanilla Dynamic Import
   *
   * This will not perform any transpilation on code, and if the host project
   * uses any custom path mappings, they will not work here. This strategy is
   * the simplest and fastest, however, so we try it first.
   */
  try {
    const config = await import(filePath);
    log.verbose(prefix, 'Used strategy:', log.chalk.bold('import()'));
    return config?.default ?? config;
  } catch (err: any) {
    errors.push(new Error(`${prefix} Failed to load file with ${log.chalk.bold('import()')}: ${err}`));
  }


  /**
   * Strategy 2: esbuild
   */
  try {
    const config = await esbuildStrategy(filePath, pkgInfo);
    log.verbose(prefix, 'Used strategy:', log.chalk.bold('esbuild'));
    return config.default ?? config;
  } catch (err: any) {
    errors.push(new Error(`${prefix} Failed to load file with ${log.chalk.bold('esbuild')}: ${err}`));
  }


  /**
   * Strategy 3: @babel/register
   *
   * This strategy creates a custom loader that uses @babel/register to
   * transpile code. The loader will work with TypeScript configuration files,
   * and it will additionally configure Babel to use path mappings defined in
   * tsconfig.json. The host project need not have a Babel configuration file in
   * place for this strategy to work. If the previous strategies failed, this
   * one should work for the majority of remaining cases.
   */
  try {
    const config = await babelRegisterStrategy(filePath, pkgInfo);
    log.verbose(prefix, 'Used strategy:', log.chalk.bold('@babel/register'));
    return config?.default ?? config;
  } catch (err: any) {
    errors.push(new Error(`${prefix} Failed to load file with ${log.chalk.bold('@babel/register')}: ${err}`));
  }

  if (errors.length > 0) throw new AggregateError(
    errors,
    'All parsing strategies failed.'
  );
}


/**
 * Creates and returns an object similar Cosmiconfig's `PublicExplorer`, but
 * returns typed configuration results. Uses our custom loader for ECMAScript
 * extensions.
 */
export default function createLoader<C>(options: SaffronCosmiconfigOptions) {
  const { fileName, ...cosmicOptions } = validators.cosmiconfigOptions(options);

  const mergedOptions = merge({
    loaders: {
      ...defaultLoaders,

      '.ts': ecmaScriptLoader,
      '.tsx': ecmaScriptLoader,
      '.mts': ecmaScriptLoader,
      '.cts': ecmaScriptLoader,

      '.js': ecmaScriptLoader,
      '.jsx': ecmaScriptLoader,
      '.mjs': ecmaScriptLoader,
      '.cjs': ecmaScriptLoader
    },
    searchPlaces: [
      `${fileName}.config.ts`,
      `${fileName}.config.tsx`,
      `${fileName}.config.mts`,
      `${fileName}.config.cts`,

      `${fileName}.config.js`,
      `${fileName}.config.jsx`,
      `${fileName}.config.mjs`,
      `${fileName}.config.cjs`,

      `${fileName}rc.ts`,
      `${fileName}rc.tsx`,
      `${fileName}rc.mts`,
      `${fileName}rc.cts`,

      `${fileName}rc.js`,
      `${fileName}rc.jsx`,
      `${fileName}rc.mjs`,
      `${fileName}rc.cjs`,

      `.${fileName}.json`,
      `.${fileName}.yaml`,
      `.${fileName}.yml`,
      `.${fileName}rc`,
      'package.json'
    ]
  }, cosmicOptions, {
    arrayMerge: (target, source) => {
      // When merging arrays (like searchPlaces) prepend the user's value to
      // our value.
      return [...source, ...target];
    }
  });

  const explorer = cosmiconfig(fileName, mergedOptions);

  return {
    load: async (filePath: string) => {
      const result = await explorer.load(filePath);
      if (result) return result as SaffronCosmiconfigResult<C>;
    },
    search: async (searchFrom?: string | undefined) => {
      const result = await explorer.search(searchFrom);
      if (result) return result as SaffronCosmiconfigResult<C>;
    }
  };
}
