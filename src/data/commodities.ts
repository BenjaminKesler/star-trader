import { SYSTEMS } from './systems'

/**
 * Commodities are keyed by the id of the system that specializes in them: every
 * star system produces exactly one signature good, so a commodity's id is its
 * home system's id. Prices tier by the producing system's role.
 */
export type CommodityId = string

export interface Commodity {
  id: CommodityId
  name: string
  basePrice: number
  /** The system that specializes in (and mass-produces) this commodity. */
  systemId: string
}

/**
 * Every commodity starts at this price. Prices then drift from here as the
 * galaxy and local market rates move each tick.
 */
export const STARTING_PRICE = 100

/**
 * The signature good each system produces, keyed by system id. The display name
 * is flavored to the system and its role. Every good starts at the same
 * {@link STARTING_PRICE}; the market rates are what pull them apart from there.
 */
const SPECIALTY_NAMES: Record<string, string> = {
  // Agricultural — staples
  'verdant-fields': 'Golden Grain',
  'amber-reach': 'Winter Wheat',
  wheatfall: 'Fresh Produce',
  'sunkissed-terraces': 'Orchard Fruit',
  greenhaven: 'Paddy Rice',
  'sable-meadow': 'Prime Livestock',
  'sunreach-orchard': 'Spiced Cider',
  'driftwood-commons': 'Exotic Spices',
  'harvest-reach': 'Milled Grain',

  // Mining — raw materials
  ironhold: 'Iron Ore',
  'rustbelt-drift': 'Scrap Metal',
  'deep-vein': 'Raw Crystals',
  grimhold: 'Pig Iron',
  'cobalt-shaft': 'Smelted Ingots',
  'cragmont-vein': 'Copper Ore',
  'ashfall-quarry': 'Trace Minerals',
  'basalt-hollow': 'Quarried Stone',
  'obsidian-drift': 'Volcanic Glass',

  // Industrial — fabricated goods
  'forge-city': 'Heavy Machinery',
  'cinder-yards': 'Tempered Alloys',
  'anvil-reach': 'Precision Components',
  'foundry-nine': 'Rolled Steel',
  'assembly-point': 'Prefab Modules',
  slagreach: 'Hull Plating',
  'bastion-works': 'Fusion Turbines',
  'ironvale-forge': 'Steel Girders',
  'anchor-yards': 'Freighter Hulls',

  // Tech — electronics
  'neon-spire': 'Quantum Processors',
  'halcyon-web': 'Logic Circuits',
  'quartz-loom': 'Silicon Chips',
  'circuit-hollow': 'Logic Boards',
  'signal-crest': 'Sensor Arrays',
  'pulse-array': 'Optical Sensors',
  'wraith-circuit': 'Nanochips',
  'beacon-relay': 'Subspace Transmitters',
  'nova-loom': 'Fiber Optics',

  // Luxury — premium goods
  'gilded-court': 'Fine Silk',
  'opal-bazaar': 'Precious Gems',
  'velvet-crown': 'Woven Textiles',
  silktrade: 'Royal Brocade',
  'gala-reach': 'Rare Perfume',
  'moonlit-bazaar': 'Fine Jewelry',
  'crimson-veil': 'Vintage Wine',
  'ivory-spire': 'Jade Carvings',
  'silver-court': 'Platinum Filigree',
}

export const COMMODITIES: Commodity[] = SYSTEMS.map((system) => {
  const name = SPECIALTY_NAMES[system.id]
  if (!name) {
    throw new Error(`No specialty commodity defined for system "${system.id}"`)
  }
  return {
    id: system.id,
    systemId: system.id,
    name,
    basePrice: STARTING_PRICE,
  }
}).sort((a, b) => a.name.localeCompare(b.name))

/** The commodity a given system specializes in producing. */
export function specialtyOf(systemId: string): Commodity | undefined {
  return COMMODITIES.find((c) => c.systemId === systemId)
}
