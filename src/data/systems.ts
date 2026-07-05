import type { CommodityId } from './commodities'

export type SystemRole = 'agricultural' | 'mining' | 'industrial' | 'tech' | 'luxury'

export interface StarSystem {
  id: string
  name: string
  role: SystemRole
  x: number
  y: number
  produces: CommodityId[]
}

export const SYSTEMS: StarSystem[] = [
  {
    id: 'verdant-fields',
    name: 'Verdant Fields',
    role: 'agricultural',
    x: 512,
    y: 140,
    produces: ['food'],
  },
  {
    id: 'neon-spire',
    name: 'Neon Spire',
    role: 'tech',
    x: 760,
    y: 300,
    produces: ['electronics'],
  },
  {
    id: 'gilded-court',
    name: 'Gilded Court',
    role: 'luxury',
    x: 670,
    y: 570,
    produces: ['luxury'],
  },
  {
    id: 'ironhold',
    name: 'Ironhold',
    role: 'mining',
    x: 355,
    y: 570,
    produces: ['ore'],
  },
  {
    id: 'forge-city',
    name: 'Forge City',
    role: 'industrial',
    x: 265,
    y: 300,
    produces: ['machinery'],
  },
]
