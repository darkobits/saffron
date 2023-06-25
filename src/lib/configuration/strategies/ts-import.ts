import path from 'path';

import fs from 'fs-extra';
import * as tsImport from 'ts-import';

import log from 'lib/log';


/**
 * Uses ts-import to dynamically import TypeScript configuration files.
 */
export async function tsImportStrategy(filePath: string) {
  const result = await tsImport.load(filePath, {
    // Slower, but allows files to be considered as part of larger TypeScript
    // programs, which should allow path mappings to work.
    mode: tsImport.LoadMode.Compile,
    // N.B. Even with this set to false, ts-import still seems to create (and
    // leave behind) a .cache directory.
    useCache: false
  });

  // Clean-up the cache directory left behind by ts-import.
  try {
    await fs.remove(path.join(path.dirname(filePath), '.cache'));
  } catch (err: any) {
    log.error(log.prefix('ts-import'), 'Error removing cache directory:', err);
  }

  return result?.default || result;
}
