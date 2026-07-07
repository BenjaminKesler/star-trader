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
  'verdant-fields': { name: 'Verdant Grain', basePrice: 12 },
  'amber-reach': { name: 'Amber Wheat', basePrice: 11 },
  wheatfall: { name: 'Wheatfall Produce', basePrice: 9 },
  'sunkissed-terraces': { name: 'Sunkissed Fruit', basePrice: 13 },
  greenhaven: { name: 'Greenhaven Rice', basePrice: 10 },
  'sable-meadow': { name: 'Sable Livestock', basePrice: 14 },
  'sunreach-orchard': { name: 'Sunreach Cider', basePrice: 13 },
  'driftwood-commons': { name: 'Driftwood Spices', basePrice: 15 },
  'harvest-reach': { name: 'Harvest Grain', basePrice: 11 },

  // Mining — raw materials
  ironhold: { name: 'Ironhold Ore', basePrice: 16 },
  'rustbelt-drift': { name: 'Rustbelt Scrap', basePrice: 17 },
  'deep-vein': { name: 'Deep Vein Crystals', basePrice: 24 },
  grimhold: { name: 'Grimhold Iron', basePrice: 18 },
  'cobalt-shaft': { name: 'Cobalt Ingots', basePrice: 22 },
  'cragmont-vein': { name: 'Cragmont Ore', basePrice: 19 },
  'ashfall-quarry': { name: 'Ashfall Minerals', basePrice: 20 },
  'basalt-hollow': { name: 'Basalt Stone', basePrice: 16 },
  'obsidian-drift': { name: 'Obsidian Shards', basePrice: 26 },

  // Industrial — fabricated goods
  'forge-city': { name: 'Forge Machinery', basePrice: 40 },
  'cinder-yards': { name: 'Cinder Alloys', basePrice: 42 },
  'anvil-reach': { name: 'Anvil Components', basePrice: 44 },
  'foundry-nine': { name: 'Foundry Steel', basePrice: 38 },
  'assembly-point': { name: 'Assembly Modules', basePrice: 46 },
  slagreach: { name: 'Slagreach Plating', basePrice: 41 },
  'bastion-works': { name: 'Bastion Turbines', basePrice: 48 },
  'ironvale-forge': { name: 'Ironvale Girders', basePrice: 43 },
  'anchor-yards': { name: 'Anchor Hulls', basePrice: 45 },

  // Tech — high-value electronics
  'neon-spire': { name: 'Neon Processors', basePrice: 90 },
  'halcyon-web': { name: 'Halcyon Circuits', basePrice: 92 },
  'quartz-loom': { name: 'Quartz Chips', basePrice: 94 },
  'circuit-hollow': { name: 'Circuit Boards', basePrice: 88 },
  'signal-crest': { name: 'Signal Arrays', basePrice: 96 },
  'pulse-array': { name: 'Pulse Sensors', basePrice: 91 },
  'wraith-circuit': { name: 'Wraith Microchips', basePrice: 98 },
  'beacon-relay': { name: 'Beacon Transmitters', basePrice: 93 },
  'nova-loom': { name: 'Nova Optics', basePrice: 97 },

  // Luxury — premium goods
  'gilded-court': { name: 'Gilded Silk', basePrice: 200 },
  'opal-bazaar': { name: 'Opal Gems', basePrice: 210 },
  'velvet-crown': { name: 'Velvet Textiles', basePrice: 205 },
  silktrade: { name: 'Silktrade Brocade', basePrice: 215 },
  'gala-reach': { name: 'Gala Perfume', basePrice: 220 },
  'moonlit-bazaar': { name: 'Moonlit Jewelry', basePrice: 225 },
  'crimson-veil': { name: 'Crimson Wine', basePrice: 230 },
  'ivory-spire': { name: 'Ivory Carvings', basePrice: 218 },
  'silver-court': { name: 'Silver Filigree', basePrice: 208 },
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
