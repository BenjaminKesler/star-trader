export interface Rank {
  /** 1-based tier, ascending. */
  tier: number
  name: string
  /** Minimum net worth to hold this rank. Placeholder values, tuned later. */
  minNetWorth: number
}

/**
 * Career ranks unlocked by net worth. Ordered ascending; the highest rank
 * whose threshold you meet is your current rank. Thresholds are rough
 * placeholders for now and will be revisited during balancing.
 */
export const RANKS: Rank[] = [
  { tier: 1, name: 'Drifter', minNetWorth: 0 },
  { tier: 2, name: 'Peddler', minNetWorth: 5_000 },
  { tier: 3, name: 'Trader', minNetWorth: 15_000 },
  { tier: 4, name: 'Merchant', minNetWorth: 40_000 },
  { tier: 5, name: 'Broker', minNetWorth: 100_000 },
  { tier: 6, name: 'Financier', minNetWorth: 250_000 },
  { tier: 7, name: 'Magnate', minNetWorth: 600_000 },
  { tier: 8, name: 'Tycoon', minNetWorth: 1_500_000 },
  { tier: 9, name: 'Baron', minNetWorth: 4_000_000 },
  { tier: 10, name: 'Mogul', minNetWorth: 10_000_000 },
  { tier: 11, name: 'Overlord', minNetWorth: 25_000_000 },
  { tier: 12, name: 'Star Emperor', minNetWorth: 60_000_000 },
]

/** The highest rank whose threshold the given net worth meets. */
export function rankForNetWorth(netWorth: number): Rank {
  let current = RANKS[0]
  for (const rank of RANKS) {
    if (netWorth >= rank.minNetWorth) current = rank
    else break
  }
  return current
}

/** The next rank up, or null if already at the top tier. */
export function nextRank(rank: Rank): Rank | null {
  return RANKS[rank.tier] ?? null
}
