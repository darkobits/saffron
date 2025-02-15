import path from 'path'

import { cosmiconfig, defaultLoaders } from 'cosmiconfig'
import merge from 'deepmerge'

import validators from 'etc/validators'
import { esbuildStrategy } from 'lib/configuration/strategies/esbuild'
import log from 'lib/log'
import { getPackageInfo } from 'lib/package'

import type {
  SaffronCosmiconfigOptions,
  SaffronCosmiconfigResult
} from 'etc/types'

/**
 * @private
 *
 * Drills-down on nested default keys in imported configuration files, which is
 * unfortunately A Thing, and the amount of nesting can vary depending on the
 * compilation target used (ie: based on the end-user's environment).
 */
function getDefaultExport(module: any) {
  let result = module
  while (Reflect.has(result, 'default')) result = Reflect.get(result, 'default')
  return result
}

/**
 * @private
 *
 * Custom Cosmiconfig loader that uses multiple strategies to attempt to load an
 * ECMAScript configuration file. Designed to work with applications written in
 * ESM or CJS, for the consumers of those applications to be written in ESM or
 * CJS, and with configuration files written in ESM or CJS.
 */
async function ecmaScriptLoader(filePath: string /* , contents: string */) {
  const prefix = log.chalk.green('config')
  log.verbose(prefix, `Loading file: ${log.chalk.green(filePath)}`)

  /**
   * Tracks errors produced by various strategies. If all strategies fail, an
   * AggregateError will be thrown with this value.
   */
  const errors: Array<Error> = []

  /**
   * Strategy 1: Dynamic Import
   *
   * This will not perform any transpilation on code, and if the host project
   * uses any language features that require transpilation, this strategy will
   * fail. However, this strategy is the simplest and fastest, so we always try
   * it first.
   */
  try {
    const result = await import(filePath)
    log.verbose(prefix, 'Used strategy:', log.chalk.bold('import()'))
    return getDefaultExport(result)
  } catch (err: any) {
    errors.push(new Error(`${prefix} Failed to load file with ${log.chalk.bold('import()')}: ${err}`))
  }

  /**
   * Strategy 2: esbuild
   *
   * Uses esbuild to transpile the indicated file.
   */
  try {
    const pkgInfo = getPackageInfo({ cwd: path.dirname(filePath) })
    if (!pkgInfo?.root) throw new Error(`${prefix} Unable to compute host package root directory.`)

    const result = await esbuildStrategy(filePath, {
      pkg: {
        root: pkgInfo.root,
        type: pkgInfo.json?.type
      }
    })

    log.verbose(prefix, 'Used strategy:', log.chalk.bold('esbuild'))

    return getDefaultExport(result)
  } catch (err: any) {
    errors.push(new Error(`${prefix} Failed to load file with ${log.chalk.bold('esbuild')}: ${err}`))
  }

  if (errors.length > 0) throw new AggregateError(errors, 'All parsing strategies failed.')
}

/**
 * Creates and returns an object similar Cosmiconfig's `PublicExplorer`, but
 * with typed configuration results. Uses our custom loader for ECMAScript
 * extensions.
 */
export default function createLoader<C>(options: Partial<SaffronCosmiconfigOptions>) {
  const { fileName, ...cosmicOptions } = validators.cosmiconfigOptions(options)

  const mergedOptions = merge({
    loaders: {
      ...defaultLoaders,

      '.ts': ecmaScriptLoader,
      '.tsx': ecmaScriptLoader,
      '.mts': ecmaScriptLoader,
      '.cts': ecmaScriptLoader,

      '.js': ecmaScriptLoader,
      '.jsx': ecmaScriptLoader,
      '.mjs': ecmaScriptLoader,
      '.cjs': ecmaScriptLoader
    },
    searchPlaces: [
      `${fileName}.config.ts`,
      `${fileName}.config.tsx`,
      `${fileName}.config.mts`,
      `${fileName}.config.cts`,

      `${fileName}.config.js`,
      `${fileName}.config.jsx`,
      `${fileName}.config.mjs`,
      `${fileName}.config.cjs`,

      `${fileName}rc.ts`,
      `${fileName}rc.tsx`,
      `${fileName}rc.mts`,
      `${fileName}rc.cts`,

      `${fileName}rc.js`,
      `${fileName}rc.jsx`,
      `${fileName}rc.mjs`,
      `${fileName}rc.cjs`,

      `.${fileName}.json`,
      `.${fileName}.yaml`,
      `.${fileName}.yml`,
      `.${fileName}rc`,
      'package.json'
    ]
  }, cosmicOptions, {
    arrayMerge: (target, source) => {
      // When merging arrays (like searchPlaces) prepend the user's value to
      // our value.
      return [...source, ...target]
    }
  })

  const explorer = cosmiconfig(fileName, mergedOptions)

  return {
    load: async (filePath: string) => {
      const result = await explorer.load(filePath)
      if (result) return result as SaffronCosmiconfigResult<C>
    },
    search: async (searchFrom?: string | undefined) => {
      const result = await explorer.search(searchFrom)
      if (result) return result as SaffronCosmiconfigResult<C>
    }
  }
}