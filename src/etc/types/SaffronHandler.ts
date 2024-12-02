import type { SaffronHandlerContext } from './SaffronHandlerContext'

/**
 * Signature of handlers.
 */
export type SaffronHandler<A, C> = (context: SaffronHandlerContext<A, C>) => Promise<void> | void;