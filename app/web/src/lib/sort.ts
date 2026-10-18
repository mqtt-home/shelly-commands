import { ActorStatus } from '@/types/actor'

/** By configured rank, then by name. */
export const byRank = (a: ActorStatus, b: ActorStatus) => a.rank - b.rank || a.name.localeCompare(b.name)
