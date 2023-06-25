import fs from 'fs';
import path from 'path';

import { dirname } from '@darkobits/fd-name';
import {
  readPackageUpSync,
  type NormalizedPackageJson
} from 'read-pkg-up';


/**
 * Object returned by `getPackageInfo`.
 */
export interface PackageInfo {
  json: NormalizedPackageJson | undefined;
  root: string | undefined;
}


type PackageType = 'host' | 'local' | 'process';


/**
 * @private
 *
 * Module-local cache of package info lookups.
 */
const packageCache = new Map<PackageType, PackageInfo>();


/**
 * Loads the package.json of the host or local package and returns the
 * normalized result and the package's root directory. Results are cached.
 */
export function getPackageInfo(type: PackageType): PackageInfo {
  const cwdMap: Record<PackageType, string | undefined> = {
    // This will resolve the real path of the directory containing the script
    // that is the process entrypoint (CLI).
    process: path.dirname(fs.realpathSync(process.argv[1])),
    // This will resolve to the package.json nearest to the current directory,
    // which should be that of the project that is using the CLI.
    host: process.cwd(),
    // This will resolve the directory name of this file; crawling up from it
    // will resolve our package.json.
    local: dirname()
  };

  // Cache miss; populate cache.
  if (!packageCache.has(type)) {
    const cwd = cwdMap[type];
    if (!cwd) throw new Error(`[getPackageInfo] Unable to compute cwd for the ${type} package.`);

    const packageResult = readPackageUpSync({ cwd });
    if (!packageResult) throw new Error(`[getPackageInfo] Unable to get metadata for the ${type} package.`);

    packageCache.set(type, {
      json: packageResult.packageJson,
      root: path.dirname(packageResult.path)
    });
  }

  // Return from cache.
  return packageCache.get(type) as PackageInfo;
}
