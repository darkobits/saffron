import path from 'path';

import { babelRegisterStrategy } from 'lib/configuration/strategies/babel-register';
import { esbuildStrategy } from 'lib/configuration/strategies/esbuild';
import { tsImportStrategy } from 'lib/configuration/strategies/ts-import';
import { TypeScriptLoader } from 'lib/configuration/strategies/ts-node';
import log from 'lib/log';
import { getPackageInfo } from 'lib/package';


/**
 * Cosmiconfig custom loader that supports ESM syntax. It allows host
 * applications to be written in ESM or CJS, and for the consumers of those
 * applications to write configuration files as ESM or CJS.
 */
export default async function configurationLoader(filePath: string, content: string) {
  const errors: Array<Error> = [];

  const pkgInfo = getPackageInfo({ cwd: path.dirname(filePath) });
  if (!pkgInfo?.root) throw new Error(`${log.prefix('configurationLoader')} Unable to compute host package root directory.`);


  /**
   * Strategy 1: Vanilla Dynamic Import
   *
   * This will not perform any transpilation on code, and if the host project
   * uses any custom path mappings, they will not work here. This strategy is
   * the simplest and fastest, however, so we try it first.
   */
  try {
    const config = await import(filePath);
    log.verbose(log.prefix('configurationLoader'), 'Used strategy:', log.chalk.bold('import()'));
    return config?.default ?? config;
  } catch (err: any) {
    errors.push(new Error(`${log.prefix('configurationLoader')} Failed to load configuration with ${log.chalk.bold('dynamic import')}: ${err}`));
  }


  /**
   * Strategy 2: esbuild
   */
  try {
    const config = await esbuildStrategy(filePath, pkgInfo);
    log.verbose(log.prefix('configurationLoader'), 'Used strategy:', log.chalk.bold('esbuild'));
    return config.default ?? config;
  } catch (err: any) {
    errors.push(new Error(`${log.prefix('configurationLoader')} Failed to load configuration with ${log.chalk.bold('esbuild')}: ${err}`));
  }


  /**
   * Strategy 3: ts-import
   */
  try {
    const config = await tsImportStrategy(filePath);
    log.verbose(log.prefix('configurationLoader'), 'Used strategy:', log.chalk.bold('ts-import'));
    return config?.default ?? config;
  } catch (err: any) {
    errors.push(new Error(`${log.prefix('configurationLoader')} Failed to load configuration with ${log.chalk.bold('ts-import')}: ${err}`));
  }


  /**
   * Strategy 4: ts-node
   *
   * This strategy is in place in the event that @babel/register did not work
   * for some reason, but it is not ideal for reasons explained above.
   */
  try {
    const tsLoader = TypeScriptLoader();
    const config = await tsLoader(filePath, content, pkgInfo);
    log.verbose(log.prefix('configurationLoader'), 'Used strategy:', log.chalk.bold('ts-node'));
    return config;
  } catch (err: any) {
    errors.push(new Error(`${log.prefix('configurationLoader')} Failed to load configuration with ${log.chalk.bold('TypeScriptLoader')}: ${err}`));
  }


  /**
   * Strategy 5: @babel/register
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
    const config = await babelRegisterStrategy(filePath, pkgInfo);
    log.verbose(log.prefix('configurationLoader'), 'Used strategy:', log.chalk.bold('@babel/register'));
    return config?.default ?? config;
  } catch (err: any) {
    errors.push(err);
  }

  if (errors.length > 0) throw new AggregateError(
    errors,
    'All parsing strategies failed.'
  );
}
