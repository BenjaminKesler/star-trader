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
 * The signature good each system produces, keyed by system id. The display name
 * is flavored to the system and its role; the base price sits in the tier for
 * that role (agriculture cheap, luxury dear) with per-system variation so no two
 * goods price identically.
 */
const SPECIALTIES: Record<string, { name: string; basePrice: number }> = {
  // Agricultural — cheap staples
  'verdant-fields': { name: 'Golden Grain', basePrice: 12 },
  'amber-reach': { name: 'Winter Wheat', basePrice: 11 },
  wheatfall: { name: 'Fresh Produce', basePrice: 9 },
  'sunkissed-terraces': { name: 'Orchard Fruit', basePrice: 13 },
  greenhaven: { name: 'Paddy Rice', basePrice: 10 },
  'sable-meadow': { name: 'Prime Livestock', basePrice: 14 },
  'sunreach-orchard': { name: 'Spiced Cider', basePrice: 13 },
  'driftwood-commons': { name: 'Exotic Spices', basePrice: 15 },
  'harvest-reach': { name: 'Milled Grain', basePrice: 11 },

  // Mining — raw materials
  ironhold: { name: 'Iron Ore', basePrice: 16 },
  'rustbelt-drift': { name: 'Scrap Metal', basePrice: 17 },
  'deep-vein': { name: 'Raw Crystals', basePrice: 24 },
  grimhold: { name: 'Pig Iron', basePrice: 18 },
  'cobalt-shaft': { name: 'Smelted Ingots', basePrice: 22 },
  'cragmont-vein': { name: 'Copper Ore', basePrice: 19 },
  'ashfall-quarry': { name: 'Trace Minerals', basePrice: 20 },
  'basalt-hollow': { name: 'Quarried Stone', basePrice: 16 },
  'obsidian-drift': { name: 'Volcanic Glass', basePrice: 26 },

  // Industrial — fabricated goods
  'forge-city': { name: 'Heavy Machinery', basePrice: 40 },
  'cinder-yards': { name: 'Tempered Alloys', basePrice: 42 },
  'anvil-reach': { name: 'Precision Components', basePrice: 44 },
  'foundry-nine': { name: 'Rolled Steel', basePrice: 38 },
  'assembly-point': { name: 'Prefab Modules', basePrice: 46 },
  slagreach: { name: 'Hull Plating', basePrice: 41 },
  'bastion-works': { name: 'Fusion Turbines', basePrice: 48 },
  'ironvale-forge': { name: 'Steel Girders', basePrice: 43 },
  'anchor-yards': { name: 'Freighter Hulls', basePrice: 45 },

  // Tech — high-value electronics
  'neon-spire': { name: 'Quantum Processors', basePrice: 90 },
  'halcyon-web': { name: 'Logic Circuits', basePrice: 92 },
  'quartz-loom': { name: 'Silicon Chips', basePrice: 94 },
  'circuit-hollow': { name: 'Logic Boards', basePrice: 88 },
  'signal-crest': { name: 'Sensor Arrays', basePrice: 96 },
  'pulse-array': { name: 'Optical Sensors', basePrice: 91 },
  'wraith-circuit': { name: 'Nanochips', basePrice: 98 },
  'beacon-relay': { name: 'Subspace Transmitters', basePrice: 93 },
  'nova-loom': { name: 'Fiber Optics', basePrice: 97 },

  // Luxury — premium goods
  'gilded-court': { name: 'Fine Silk', basePrice: 200 },
  'opal-bazaar': { name: 'Precious Gems', basePrice: 210 },
  'velvet-crown': { name: 'Woven Textiles', basePrice: 205 },
  silktrade: { name: 'Royal Brocade', basePrice: 215 },
  'gala-reach': { name: 'Rare Perfume', basePrice: 220 },
  'moonlit-bazaar': { name: 'Fine Jewelry', basePrice: 225 },
  'crimson-veil': { name: 'Vintage Wine', basePrice: 230 },
  'ivory-spire': { name: 'Jade Carvings', basePrice: 218 },
  'silver-court': { name: 'Platinum Filigree', basePrice: 208 },
}

export const COMMODITIES: Commodity[] = SYSTEMS.map((system) => {
  const specialty = SPECIALTIES[system.id]
  if (!specialty) {
    throw new Error(`No specialty commodity defined for system "${system.id}"`)
  }
  return {
    id: system.id,
    systemId: system.id,
    name: specialty.name,
    basePrice: specialty.basePrice,
  }
}).sort((a, b) => a.name.localeCompare(b.name))

/** The commodity a given system specializes in producing. */
export function specialtyOf(systemId: string): Commodity | undefined {
  return COMMODITIES.find((c) => c.systemId === systemId)
}
