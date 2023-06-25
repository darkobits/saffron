import path from 'path';

import merge from 'deepmerge';
import fs from 'fs-extra';
import resolvePkg from 'resolve-pkg';
import {
  register,
  type RegisterOptions
} from 'ts-node';

import log from 'lib/log';

import type { Loader } from 'cosmiconfig';
import type { PackageInfo } from 'lib/package';


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
 * Convoluted way to dynamically transpile and import() TypeScript files at
 * runtime.
 */
export function TypeScriptLoader(options: RegisterOptions = {}) {
  // N.B. Signature for Cosmiconfig loaders.
  return async (filePath: string, content: string, pkgInfo: PackageInfo) => {
    if (!pkgInfo.root) throw new Error('Unable to determine host package root directory.');

    const tsConfigPathsRegisterPath = resolvePkg('tsconfig-paths/register', { cwd: pkgInfo.root });
    if (!tsConfigPathsRegisterPath) throw new Error('Unable to resolve path to tsconfig-paths/register.');

    let tempConfigFilePath = '';

    try {
      // ----- [1] Prepare ts-node Instance ------------------------------------

      const { ext } = path.parse(filePath);

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

      const tempConfigFileName = computeFileExtension(`.saffron-temporary-${path.basename(filePath)}`);
      const tempConfigFileDirectory = path.dirname(filePath);
      tempConfigFilePath = path.join(tempConfigFileDirectory, tempConfigFileName);


      // ----- [3] Transpile Configuration File --------------------------------

      // N.B. Not clear why ts-node (or possibly by extension, TypeScript) needs
      // both a file name _and_ its contents here.
      let transpiledConfig = tsNodeInstance.compile(content, filePath);


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
