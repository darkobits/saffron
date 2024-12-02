import type { SaffronBuilderContext } from './SaffronBuilderContext'

/**
 * Signature of a builder.
 */
export type SaffronBuilder<A> = (context: SaffronBuilderContext<A>) => void;