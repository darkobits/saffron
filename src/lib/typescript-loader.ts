import _TypeScriptLoader from '@endemolshinegroup/cosmiconfig-typescript-loader';


/**
 * This is needed because while we transpile to ESM, we still transpile to CJS
 * for testing in Jest, and certain modules will import different values based
 * on these strategies, so we have to "find" the package's true default export
 * at runtime in a way that works in both ESM and CJS.
 *
 * This is essentially a replacement for Babel's _interopRequireDefault helper
 * which is not used / added to transpiled code when transpiling to ESM.
 *
 * TODO: Move to separate package.
 */
export function getDefaultExport<T extends object>(value: T): T {
  try {
    let result = value;

    while (Reflect.has(result, 'default')) {
      // @ts-expect-error - TODO: This file may likely be removed in the future.
      result = Reflect.get(result, 'default');
    }

    return result;
  } catch {
    return value;
  }
}


export default getDefaultExport(_TypeScriptLoader);
