import fs from 'fs';
import path from 'path';

import { dirname } from '@darkobits/fd-name';
import readPkgUp, { NormalizedPackageJson } from 'read-pkg-up';


/**
 * Object returned by `getPackageInfo`.
 */
export interface PackageInfo {
  json: NormalizedPackageJson | undefined;
  root: string | undefined;
}


/**
 * @private
 *
 * Module-local cache of package info lookups.
 */
const packageCache = new Map<'host' | 'local', PackageInfo>();


/**
 * Loads the package.json of the host or local package and returns the
 * normalized result and the package's root directory. Results are cached.
 */
export function getPackageInfo(type: 'host' | 'local'): PackageInfo {
  // Cache miss; populate cache.
  if (!packageCache.has(type)) {
    const cwd = type === 'host'
      ? path.dirname(fs.realpathSync(process.argv[1]))
      :  dirname();
    if (!cwd) throw new Error(`[getOurPackageInfo] Unable to compute cwd for the ${type} package.`);

    const packageResult = readPkgUp.sync({ cwd });
    if (!packageResult) throw new Error(`[getPackageInfo] Unable to get metadata for the ${type} package.`);

    packageCache.set(type, {
      json: packageResult.packageJson,
      root: path.dirname(packageResult.path)
    });
  }

  // Return from cache.
  return packageCache.get(type) as PackageInfo;
}
