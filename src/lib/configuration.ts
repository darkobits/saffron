import { cosmiconfigSync } from 'cosmiconfig';
import merge, { } from 'deepmerge';
import esm from 'esm';
import ow from 'ow';
import { SaffronCosmiconfigOptions, SaffronCosmiconfigResult } from 'etc/types';


/**
 * Cosmiconfig custom loader that supports ESM syntax.
 */
function loadEsm(filepath: string) {
  const requireEsm = esm(module);
  const config = requireEsm(filepath);
  return config?.default ? config.default : config;
}


/**
 * Loads configuration from a configuration file using cosmiconfig. Supports
 * optional sub-key traversal.
 *
 * Note: Cosmiconfig caches every file it loads, so if multiple commands are
 * registered that use the same file, we don't have to worry about multiple
 * filesystem calls here.
 */
export default function loadConfiguration<C>({ fileName, key, searchFrom, ...cosmicOptions }: SaffronCosmiconfigOptions) {
  // Validate options.
  ow(fileName, 'fileName', ow.string.nonEmpty);
  ow(key, 'key', ow.optional.string);

  const configResult = cosmiconfigSync(fileName, merge({
    loaders: {
      '.js': loadEsm,
      '.mjs': loadEsm,
      '.cjs': loadEsm
    },
    searchPlaces: [
      'package.json',
      `.${fileName}.json`,
      `.${fileName}.yaml`,
      `.${fileName}.yml`,
      `.${fileName}rc`,
      `${fileName}.config.js`,
      // Added in cosmiconfig 7.x:
      `${fileName}.config.cjs`,
      `${fileName}rc.cjs`
    ]
  }, cosmicOptions, {
    arrayMerge: (target, source) => {
      // When merging arrays (like searchPlaces) prepend the user's value to
      // our value.
      return [...source, ...target];
    }
  })).search(searchFrom);

  // If we loaded a non-empty file and the user specified a sub-key that they
  // want to drill-down into, ensure that the root configuration object has that
  // key. If it doesn't, delete the 'config' property on our result and set
  // 'isEmpty' to true. Otherwise, hoist the desired sub-key up to the root of
  // the result.
  if (configResult && !configResult.isEmpty && key) {
    if (!Reflect.has(configResult.config, key)) {
      Reflect.deleteProperty(configResult, 'config');
      configResult.isEmpty = true;
    } else {
      configResult.config = configResult.config[key];
    }
  }

  return configResult as SaffronCosmiconfigResult<C>;
}
