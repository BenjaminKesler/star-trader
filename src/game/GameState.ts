import { COMMODITIES, type CommodityId } from '../data/commodities'
import { SYSTEMS } from '../data/systems'

const GALAXY_RATE_MIN = 0.75
const GALAXY_RATE_MAX = 1.5
const LOCAL_RATE_MIN = 0.75
const LOCAL_RATE_MAX = 1.25

const BOOM_CRASH_CHANCE = 0.12
const SMALL_MOVE_RANGE = 0.05
const BOOM_CRASH_RANGE = 0.25
const MEAN_REVERSION = 0.05

const PRODUCER_STOCK_MIN = 150
const PRODUCER_STOCK_MAX = 400
const OTHER_STOCK_MIN = 0
const OTHER_STOCK_MAX = 40

const CARGO_UPGRADE_STEP = 20
const CARGO_UPGRADE_BASE_COST = 600

type RateTable = Record<string, Record<CommodityId, number>>
type CargoHold = Record<CommodityId, number>

function emptyCargo(): CargoHold {
  return { food: 0, ore: 0, machinery: 0, electronics: 0, luxury: 0 }
}

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}

function stepRate(current: number, min: number, max: number): number {
  const isBoomOrCrash = Math.random() < BOOM_CRASH_CHANCE
  const range = isBoomOrCrash ? BOOM_CRASH_RANGE : SMALL_MOVE_RANGE
  const delta = (Math.random() * 2 - 1) * range
  const reversion = (1 - current) * MEAN_REVERSION
  const next = current + delta + reversion
  return Math.min(max, Math.max(min, next))
}

class GameStateImpl {
  companyName = 'Unnamed Trading Co.'
  shipName = 'Rusty Hauler'
  credits = 1000
  currentSystemId = SYSTEMS[0].id
  cargoCapacity = CARGO_UPGRADE_STEP
  cargoUpgradeLevel = 0
  cargo: CargoHold = emptyCargo()

  galaxyRates: Record<CommodityId, number> = {} as Record<CommodityId, number>
  localRates: RateTable = {}
  stock: RateTable = {}

  constructor() {
    for (const commodity of COMMODITIES) {
      this.galaxyRates[commodity.id] = 1
    }
    for (const system of SYSTEMS) {
      this.localRates[system.id] = {} as Record<CommodityId, number>
      this.stock[system.id] = {} as Record<CommodityId, number>
      for (const commodity of COMMODITIES) {
        this.localRates[system.id][commodity.id] = 1
        this.stock[system.id][commodity.id] = this.rolledStock(system.id, commodity.id)
      }
    }
  }

  private rolledStock(systemId: string, commodityId: CommodityId): number {
    const system = SYSTEMS.find((s) => s.id === systemId)!
    return system.produces.includes(commodityId)
      ? randomInt(PRODUCER_STOCK_MIN, PRODUCER_STOCK_MAX)
      : randomInt(OTHER_STOCK_MIN, OTHER_STOCK_MAX)
  }

  get cargoUsed(): number {
    return Object.values(this.cargo).reduce((sum, qty) => sum + qty, 0)
  }

  get cargoFree(): number {
    return this.cargoCapacity - this.cargoUsed
  }

  getPrice(commodityId: CommodityId, systemId = this.currentSystemId): number {
    const base = COMMODITIES.find((c) => c.id === commodityId)!.basePrice
    return Math.round(base * this.galaxyRates[commodityId] * this.localRates[systemId][commodityId])
  }

  getStock(commodityId: CommodityId, systemId = this.currentSystemId): number {
    return this.stock[systemId][commodityId]
  }

  get netWorth(): number {
    const cargoValue = COMMODITIES.reduce(
      (sum, c) => sum + this.getPrice(c.id) * this.cargo[c.id],
      0,
    )
    return this.credits + cargoValue
  }

  canAfford(commodityId: CommodityId, qty: number): boolean {
    return this.getPrice(commodityId) * qty <= this.credits
  }

  buy(commodityId: CommodityId, qty: number): boolean {
    if (qty <= 0) return false
    if (qty > this.cargoFree) return false
    if (qty > this.getStock(commodityId)) return false
    if (!this.canAfford(commodityId, qty)) return false

    this.credits -= this.getPrice(commodityId) * qty
    this.cargo[commodityId] += qty
    this.stock[this.currentSystemId][commodityId] -= qty
    return true
  }

  sell(commodityId: CommodityId, qty: number): boolean {
    if (qty <= 0) return false
    if (qty > this.cargo[commodityId]) return false

    this.credits += this.getPrice(commodityId) * qty
    this.cargo[commodityId] -= qty
    return true
  }

  travelTo(systemId: string) {
    if (systemId === this.currentSystemId) return
    this.currentSystemId = systemId
    this.advanceMarketTick()
  }

  private advanceMarketTick() {
    for (const commodity of COMMODITIES) {
      this.galaxyRates[commodity.id] = stepRate(
        this.galaxyRates[commodity.id],
        GALAXY_RATE_MIN,
        GALAXY_RATE_MAX,
      )
    }
    for (const system of SYSTEMS) {
      for (const commodity of COMMODITIES) {
        this.localRates[system.id][commodity.id] = stepRate(
          this.localRates[system.id][commodity.id],
          LOCAL_RATE_MIN,
          LOCAL_RATE_MAX,
        )
        this.stock[system.id][commodity.id] = this.rolledStock(system.id, commodity.id)
      }
    }
  }

  cargoUpgradeCost(): number {
    return Math.round(CARGO_UPGRADE_BASE_COST * Math.pow(1.5, this.cargoUpgradeLevel))
  }

  upgradeCargo(): boolean {
    const cost = this.cargoUpgradeCost()
    if (this.credits < cost) return false
    this.credits -= cost
    this.cargoCapacity += CARGO_UPGRADE_STEP
    this.cargoUpgradeLevel += 1
    return true
  }
}

export const gameState = new GameStateImpl()
