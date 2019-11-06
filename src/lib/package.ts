import path from 'path';
import readPkgUp from 'read-pkg-up';


/**
 * Object returned by loadPackageData.
 */
export interface PackageData {
  pkgJson?: readPkgUp.NormalizedPackageJson;
  pkgRoot?: string;
}


/**
 * Module-local cached result from read-pkg-up.
 */
const cachedPackageResult: PackageData = {};


/**
 * Loads the package.json of the host package, if one exists, and caches the
 * result.
 */
export default function getPackageInfo(): PackageData {
  if (!process.mainModule) {
    throw new Error('Unable to load package.json; process.mainModule is not set.');
  }

  if (Object.keys(cachedPackageResult).length === 0) {
    const packageResult = readPkgUp.sync({cwd: path.resolve(process.mainModule.filename)});

    if (packageResult) {
      cachedPackageResult.pkgJson = packageResult.packageJson;
      cachedPackageResult.pkgRoot = path.dirname(packageResult.path);
    }
  }

  return cachedPackageResult;
}
