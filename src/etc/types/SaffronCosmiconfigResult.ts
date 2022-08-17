/**
 * Object with the same shape as CosmiconfigResult, but with support for a typed
 * `config` key.
 */
export interface SaffronCosmiconfigResult<C> {
  config: C;
  filepath: string;
  isEmpty: boolean | undefined;
}
