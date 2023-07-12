import path from 'path';

import { TsconfigPathsPlugin } from '@esbuild-plugins/tsconfig-paths';
import * as esbuild from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';
import fs from 'fs-extra';
import currentNodeVersion from 'node-version';
import * as tsConfck from 'tsconfck';

import log from 'lib/log';

import type { PackageInfo } from 'lib/package';


/**
 * Map of input extensions to output extensions that Node can natively import.
 */
const EXT_MAP: Record<string, string> = {
  '.js': '.js',
  '.ts': '.js',
  '.tsx': '.js',
  '.jsx':' .js',
  // User explicitly wants CommonJS.
  '.cts': '.cjs',
  '.cjs': '.cjs',
  // User explicitly wants ESM.
  '.mts': '.mjs',
  '.mjs': '.mjs'
};


/**
 * Uses esbuild to transpile the file at `filePath` by creating a temporary
 * file in the same directory, then attempts to dynamically import it. An
 * output format and extension are chosen based on the host project's
 * "type" setting that are the least likely to produce errors. Once imported,
 * the temporary file is removed.
 */
export async function esbuildStrategy<M = any>(filePath: string, pkgInfo: PackageInfo): Promise<M> {
  const prefix = log.prefix('strategy:esbuild');

  const parsedFilePath = path.parse(filePath);
  const isExplicitCommonJs = ['.cjs', '.cts'].includes(parsedFilePath.ext);
  const isExplicitESM = ['.mjs', '.mts'].includes(parsedFilePath.ext);
  const outExt = EXT_MAP[parsedFilePath.ext];

  if (!outExt) throw new Error(
    `${prefix} Unable to determine output file extension from input extension: ${parsedFilePath.ext}`
  );

  // Determine the output format to use by first honoring any explicit
  // transpilation hints based on file extension, then fall back to relying on
  // the "type" field in package.json. The aim here is to use an output format
  // that is the least likely to produce errors when being dynamically imported.
  const format = isExplicitESM
    ? 'esm'
    : isExplicitCommonJs
      ? 'cjs'
      : pkgInfo.json?.type === 'module'
        ? 'esm'
        : 'cjs';

  log.verbose(prefix, `Using format: ${log.chalk.bold(format)}`);

  const tempFileName = `.${parsedFilePath.name}.${Date.now()}${outExt}`;
  const tempFilePath = path.join(path.dirname(filePath), tempFileName);

  log.verbose(prefix, `Temporary file path: ${log.chalk.green(tempFilePath)}`);

  try {
    const buildOptions: esbuild.BuildOptions = {
      entryPoints: [filePath],
      target: `node${currentNodeVersion.major}`,
      outfile: tempFileName,
      format,
      platform: 'node',
      bundle: true,
      plugins: [
        nodeExternalsPlugin({
          packagePath: path.resolve(pkgInfo.root ?? '', 'package.json')
        })
      ]
    };

    // If the user has a TypeScript configuration file, enable TypeScript
    // features.
    const tsConfigFilePath = await tsConfck.find(filePath);

    if (tsConfigFilePath) {
      log.verbose(prefix, 'Using TypeScript configuration:', log.chalk.green(tsConfigFilePath));
      buildOptions.tsconfig = tsConfigFilePath;
      buildOptions.plugins?.push(TsconfigPathsPlugin({
        tsconfig: tsConfigFilePath
      }));
    }

    // Transpile the input file.
    await esbuild.build(buildOptions);
  } catch (err: any) {
    // Handle any transpilation-related errors.
    throw new Error(
      `${log.chalk.red(`[${prefix}] Failed to transpile ${filePath}:`)} ${err.message}`,
      { cause: err }
    );
  }

  try {
    // Import the temporary file and return the result.
    return await import(tempFilePath);
  } catch (err: any) {
    // Handle any import-related errors.
    throw new Error(
      `${log.chalk.red(`[${prefix}] Failed to import() ${filePath}:`)} ${err.message}`,
      { cause: err }
    );
  } finally {
    // Remove the temporary file.
    if (await fs.exists(tempFilePath)) await fs.remove(tempFilePath);
  }
}
