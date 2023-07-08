import type { NormalizedReadResult } from 'read-pkg-up';


/**
 * Common properties for contexts provided to builders and handlers.
 */
export interface SaffronCommonContext {
  /**
   * Parsed metadata about Saffron's host package.
   */
  pkg: {
    /**
     * Normalized package.json.
     *
     * See: https://github.com/npm/normalize-package-data
     */
    json: NormalizedReadResult['packageJson'] | undefined;

    /**
     * Path to the package root.
     */
    root: string | undefined;
  } | undefined;
}
