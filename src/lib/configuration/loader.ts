import path from 'path';

import { babelRegisterStrategy } from 'lib/configuration/strategies/babel-register';
import { esbuildStrategy } from 'lib/configuration/strategies/esbuild';
import log from 'lib/log';
import { getPackageInfo } from 'lib/package';


/**
 * Cosmiconfig custom loader. It is designed to work with with dependents that
 * are written in ESM or CJS, and for the consumers of those applications to be
 * written in ESM or CJS with configuration files written in either ESM or CJS.
 */
export default async function configurationLoader(filePath: string /* , content: string */) {
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
