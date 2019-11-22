import {cosmiconfigSync} from 'cosmiconfig';
import ow from 'ow';
import {SaffronCosmiconfigOptions, SaffronCosmiconfigResult} from 'etc/types';


/**
 * Loads configuration from a configuration file using cosmiconfig. Supports
 * optional sub-key traversal.
 *
 * Note: Cosmiconfig caches every file it loads, so if multiple commands are
 * registered that use the same file, we don't have to worry about multiple
 * filesystem calls here.
 */
export default function loadConfiguration<C>({fileName, key, searchFrom, ...cosmicOptions}: SaffronCosmiconfigOptions): SaffronCosmiconfigResult<C> {
  // Validate options.
  ow(fileName, 'fileName', ow.string.nonEmpty);
  ow(key, 'key', ow.optional.string);

  // @ts-ignore -- Remove this when ow adds assertion signatures.
  const configResult = cosmiconfigSync(fileName, {
    searchPlaces: [
      'package.json',
      `.${fileName}.json`,
      `.${fileName}.yaml`,
      `.${fileName}.yml`,
      `${fileName}.config.js`,
      `.${fileName}rc`
    ],
    // N.B. If the user provided a custom searchPlaces array, it will overwrite
    // the one above.
    ...cosmicOptions
  }).search(searchFrom);

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

  return configResult;
}
