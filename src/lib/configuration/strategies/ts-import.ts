import path from 'path';

import fs from 'fs-extra';
import * as tsImport from 'ts-import';

import log from 'lib/log';


/**
 * Uses ts-import to dynamically import TypeScript configuration files.
 */
export async function tsImportStrategy(filePath: string) {
  // Clean-up the cache directory left behind by ts-import.
  const cacheDir = path.join(path.dirname(filePath), '.cache');

  try {
    const result = await tsImport.load(filePath, {
      // Slower, but allows files to be considered as part of larger TypeScript
      // programs, which should allow path mappings to work.
      mode: tsImport.LoadMode.Compile,
      // N.B. Even with this set to false, ts-import still seems to create (and
      // leave behind) a .cache directory.
      useCache: false
    });

    return result?.default || result;
  } catch (cause: any) {
    throw new Error(
      `${log.prefix('tsImportStrategy')} Failed to load configuration file: ${cause}`,
      { cause }
    );
  } finally {
    if (await fs.exists(cacheDir)) await fs.remove(cacheDir);
  }
}
