import { cosmiconfig, defaultLoaders } from 'cosmiconfig';
import merge, { } from 'deepmerge';

import { SaffronCosmiconfigOptions, SaffronCosmiconfigResult } from 'etc/types';
import validators from 'etc/validators';
import ConfigurationLoader from 'lib/configuration-loader';


/**
 * Loads configuration from a configuration file using cosmiconfig. Supports
 * optional sub-key traversal.
 *
 * Note: Cosmiconfig caches every file it loads, so if multiple commands are
 * registered that use the same file, we don't have to worry about multiple
 * filesystem calls here.
 */
export default async function loadConfiguration<C>(options: SaffronCosmiconfigOptions) {
  const { fileName, key, searchFrom, ...cosmicOptions } = validators.cosmiconfigOptions(options);

  const configResult = await cosmiconfig(fileName, merge({
    loaders: {
      ...defaultLoaders,
      '.ts': ConfigurationLoader,
      '.js': ConfigurationLoader,
      '.cts': ConfigurationLoader,
      '.cjs': ConfigurationLoader
    },
    searchPlaces: [
      'package.json',
      `.${fileName}.json`,
      `.${fileName}.yaml`,
      `.${fileName}.yml`,
      `.${fileName}rc`,
      `${fileName}.config.ts`,
      `${fileName}.config.js`,
      `${fileName}.config.cts`,
      `${fileName}.config.cjs`,
      `${fileName}rc.ts`,
      `${fileName}rc.js`,
      `${fileName}rc.cts`,
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

  if (configResult) {
    return configResult as SaffronCosmiconfigResult<C>;
  }
}
