import path from 'path'

import {
  readPackageUpSync,
  type NormalizedPackageJson
} from 'read-pkg-up'

import log from 'lib/log'

/**
 * Object returned by `getPackageInfo`.
 */
export interface PackageInfo {
  json: NormalizedPackageJson | undefined
  root: string | undefined
}

/**
 * @private
 *
 * Module-local cache of package info lookups.
 */
const packageCache = new Map<string | symbol, PackageInfo>()

interface GetPackageInfoOptions {
  cwd: string
}

/**
 * Loads the package.json of the host or local package and returns the
 * normalized result and the package's root directory. Results are cached.
 *
 * - For the manifest of the project running the CLI use `process.cwd()`.
 * - For the manifest of the project implementing the CLI, use
 *   `path.dirname(fs.realpathSync(process.argv[1]))`.
 */
export function getPackageInfo({ cwd }: GetPackageInfoOptions): PackageInfo {
  // Cache miss; populate cache.
  if (!packageCache.has(cwd)) {
    const packageResult = readPackageUpSync({ cwd })
    if (!packageResult) throw new Error(`${log.chalk.green('getPackageInfo')} Unable to get package metadata from: ${log.chalk.green(cwd)}`)

    packageCache.set(cwd, {
      json: packageResult.packageJson,
      root: path.dirname(packageResult.path)
    })
  }

  // Return from cache.
  return packageCache.get(cwd) as PackageInfo
}

type ParsedPackageName<T> = T extends string
  ? {scope: string | undefined; name: string}
  : {scope: undefined; name: undefined};

export function parsePackageName<T = any>(packageName: T) {
  if (typeof packageName !== 'string') {
    return { scope: undefined, name: undefined } as ParsedPackageName<T>
  }

  if (packageName.includes('/')) {
    const [scope, name] = packageName.replace('@', '').split('/')
    return { scope, name } as ParsedPackageName<T>
  }

  return { scope: undefined, name: packageName }
}