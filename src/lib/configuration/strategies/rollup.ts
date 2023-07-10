import path from 'path';

import typescriptPlugin from '@rollup/plugin-typescript';
import fs from 'fs-extra';
import {
  rollup,
  type InputOptions,
  type OutputOptions
} from 'rollup';
import { nodeExternals } from 'rollup-plugin-node-externals';
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
 * tsConfck will throw if provided a `root` and fails to find a tsconfig file.
 *
 * TODO: Update other strategies.
 */
async function findTsConfig(filePath: string, root: string) {
  try {
    return await tsConfck.find(filePath, { root });
  } catch {
    return false;
  }
}


/**
 * Uses Rollup to transpile the file at `filePath` by creating a temporary
 * file in the same directory, then attempts to dynamically import it. An
 * output format and extension are chosen based on the host project's
 * "type" setting that are the least likely to produce errors. Once imported,
 * the temporary file is removed.
 */
export async function rollupStrategy<M = any>(filePath: string, pkgInfo: PackageInfo): Promise<M> {
  const prefix = log.prefix('strategy:rollup');

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
    ? 'es'
    : isExplicitCommonJs
      ? 'cjs'
      : pkgInfo.json?.type === 'module'
        ? 'es'
        : 'cjs';

  log.verbose(prefix, `Using format: ${log.chalk.bold(format)}`);

  const tempFileName = `.${parsedFilePath.name}.${Date.now()}${outExt}`;
  const tempFilePath = path.join(path.dirname(filePath), tempFileName);

  log.verbose(prefix, `Temporary file path: ${log.chalk.green(tempFilePath)}`);

  try {
    if (!pkgInfo.root) throw new Error('Unable to determine package root.');

    const inputOptions: InputOptions = {
      input: filePath,
      plugins: [
        nodeExternals({
          builtinsPrefix: 'ignore',
          packagePath: path.resolve(pkgInfo.root, 'package.json'),
          deps: true,
          devDeps: true,
          peerDeps: true,
          optDeps: true
        })
      ]
    };

    // If the user has a TypeScript configuration file, enable TypeScript
    // features.
    const tsConfigFilePath = await findTsConfig(filePath, pkgInfo.root);

    if (tsConfigFilePath && Array.isArray(inputOptions.plugins)) {
      log.verbose(prefix, 'Using TypeScript configuration:', log.chalk.green(tsConfigFilePath));
      // Add TypeScript config to inputOptions here.
      inputOptions.plugins?.push(typescriptPlugin({
        sourceMap: false,
        outputToFilesystem: false
      }));
    }

    const bundle = await rollup(inputOptions);

    const outputOptions: OutputOptions = {
      format,
      sourcemap: false
    };

    const { output } = await bundle.generate(outputOptions);

    for (const chunk of output) {
      if (chunk.type === 'chunk') {
        // log.info(prefix, chunk.code);
        // console.log('');
        await fs.writeFile(tempFilePath, chunk.code);
      }
    }
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
