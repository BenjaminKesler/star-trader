export type CommodityId = 'food' | 'ore' | 'machinery' | 'electronics' | 'luxury'

export interface Commodity {
  id: CommodityId
  name: string
  basePrice: number
}

export const COMMODITIES: Commodity[] = [
  { id: 'food', name: 'Food', basePrice: 10 },
  { id: 'ore', name: 'Ore', basePrice: 15 },
  { id: 'machinery', name: 'Machinery', basePrice: 40 },
  { id: 'electronics', name: 'Electronics', basePrice: 90 },
  { id: 'luxury', name: 'Luxury Goods', basePrice: 200 },
]
