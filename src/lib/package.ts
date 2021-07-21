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
 * Loads the package.json of the host application, if one exists, and caches the
 * result.
 */
export default function getPackageInfo(): PackageData {
  if (Object.keys(cachedPackageResult).length === 0) {
    const packageResult = readPkgUp.sync({
      cwd: path.dirname(process.argv[1])
    });

    if (packageResult) {
      cachedPackageResult.pkgJson = packageResult.packageJson;
      cachedPackageResult.pkgRoot = path.dirname(packageResult.path);
    }
  }

  return cachedPackageResult;
}
