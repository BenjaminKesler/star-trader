/**
 * Ship expansions sold at the Outfitter. Each installed expansion occupies one
 * of the ship's expansion bays, so a ship can carry only as many as it has bays.
 * Installing costs the item's full price; selling one back refunds half (and
 * frees the bay it used). The same item can be installed more than once — its
 * effect stacks — as long as bays and credits allow.
 */

export type ExpansionId = 'fuel-tank' | 'engine-upgrade' | 'cargo-bay'

export interface Expansion {
  id: ExpansionId
  name: string
  /** One-line summary of what installing this does, shown in the store. */
  description: string
  /** Credit cost to install. Selling back refunds half (rounded down). */
  price: number
}

/** Fuel capacity, in units, added per installed Fuel Tank. */
export const FUEL_TANK_CAPACITY = 5000
/** Fractional travel-speed boost per installed Engine Upgrade (0.5 = +50% faster). */
export const ENGINE_SPEED_BONUS = 0.5
/** Cargo capacity, in units, added per installed Cargo Bay. */
export const CARGO_BAY_CAPACITY = 20

export const EXPANSIONS: Expansion[] = [
  {
    id: 'fuel-tank',
    name: 'Fuel Tank',
    description: `Expands fuel capacity by ${FUEL_TANK_CAPACITY.toLocaleString()}.`,
    price: 800,
  },
  {
    id: 'engine-upgrade',
    name: 'Engine Upgrade',
    description: 'Speeds up travel by 50%.',
    price: 1500,
  },
  {
    id: 'cargo-bay',
    name: 'Cargo Bay',
    description: `Increases cargo capacity by ${CARGO_BAY_CAPACITY}.`,
    price: 600,
  },
]

export const EXPANSION_BY_ID: Record<ExpansionId, Expansion> = EXPANSIONS.reduce(
  (map, expansion) => {
    map[expansion.id] = expansion
    return map
  },
  {} as Record<ExpansionId, Expansion>,
)
