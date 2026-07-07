import { COMMODITIES, type CommodityId } from '../data/commodities'
import { SYSTEMS, type StarSystem } from '../data/systems'
import { rankForNetWorth, type Rank } from '../data/ranks'

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

// --- Daily production / consumption ---
// A system makes its signature good each day at this rate per million residents,
// and its people consume some other good at this rate per million residents.
const PRODUCTION_PER_MILLION = 2
const CONSUMPTION_PER_MILLION = 1
/** A commodity can be stockpiled up to the system's daily production rate times this. */
const MAX_STORAGE_MULTIPLIER = 1000
/** Production is halved on any day the system holds no imported goods to draw on. */
const NO_IMPORTS_PENALTY = 0.5
/** Each distinct imported good in stock multiplies production by this (compounding). */
const VARIETY_BONUS_PER_IMPORT = 1.08

const CARGO_UPGRADE_STEP = 20
const CARGO_UPGRADE_BASE_COST = 600

/** Temporary flat rate to fully refuel, regardless of how empty the tank is. */
const REFUEL_COST = 10

/** Each jump advances the galaxy date by its straight-line distance over this. */
const GALAXY_DATE_DIVISOR = 150
const GALAXY_EPOCH_YEAR = 3200
const DAYS_PER_YEAR = 365

type RateTable = Record<string, Record<CommodityId, number>>
type CargoHold = Record<CommodityId, number>

function emptyCargo(): CargoHold {
  const cargo = {} as CargoHold
  for (const commodity of COMMODITIES) {
    cargo[commodity.id] = 0
  }
  return cargo
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
  fuel = 5000
  maxFuel = 5000
  currentSystemId = SYSTEMS[0].id
  galaxyDate = 0
  /** Whole galaxy-days already run through production/consumption. */
  private processedDay = 0
  cargoCapacity = CARGO_UPGRADE_STEP
  cargoUpgradeLevel = 0
  cargo: CargoHold = emptyCargo()
  private cargoBasis: CargoHold = emptyCargo()

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
    // Every system specializes in the commodity sharing its id; it mass-produces
    // that one and stocks only trace amounts of everything else.
    return systemId === commodityId
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

  get rank(): Rank {
    return rankForNetWorth(this.netWorth)
  }

  /** Total credit value of all commodity stock sitting in a system's market. */
  systemNetWorth(systemId: string): number {
    return COMMODITIES.reduce(
      (sum, c) => sum + this.getPrice(c.id, systemId) * this.getStock(c.id, systemId),
      0,
    )
  }

  /** Combined net worth of every system's market across the whole galaxy. */
  get galaxyNetWorth(): number {
    return SYSTEMS.reduce((sum, s) => sum + this.systemNetWorth(s.id), 0)
  }

  /** Formats a galaxy-date value as a "YEAR.DAY" stardate, e.g. "3200.001". */
  formatGalaxyDate(date: number): string {
    const totalDays = Math.floor(date)
    const year = GALAXY_EPOCH_YEAR + Math.floor(totalDays / DAYS_PER_YEAR)
    const day = (totalDays % DAYS_PER_YEAR) + 1
    return `${year}.${String(day).padStart(3, '0')}`
  }

  /** The current galaxy date as a "YEAR.DAY" stardate, e.g. "3200.001". */
  get galaxyDateString(): string {
    return this.formatGalaxyDate(this.galaxyDate)
  }

  canAfford(commodityId: CommodityId, qty: number): boolean {
    return this.getPrice(commodityId) * qty <= this.credits
  }

  getAverageBasis(commodityId: CommodityId): number | null {
    const held = this.cargo[commodityId]
    if (held <= 0) return null
    return this.cargoBasis[commodityId] / held
  }

  getBasisDeltaPercent(commodityId: CommodityId, systemId = this.currentSystemId): number | null {
    const basis = this.getAverageBasis(commodityId)
    if (basis === null) return null
    const price = this.getPrice(commodityId, systemId)
    return ((price - basis) / basis) * 100
  }

  buy(commodityId: CommodityId, qty: number): boolean {
    if (qty <= 0) return false
    if (qty > this.cargoFree) return false
    if (qty > this.getStock(commodityId)) return false
    if (!this.canAfford(commodityId, qty)) return false

    const cost = this.getPrice(commodityId) * qty
    this.credits -= cost
    this.cargo[commodityId] += qty
    this.cargoBasis[commodityId] += cost
    this.stock[this.currentSystemId][commodityId] -= qty
    return true
  }

  sell(commodityId: CommodityId, qty: number): boolean {
    if (qty <= 0) return false
    if (qty > this.cargo[commodityId]) return false
    if (qty > this.stockSpace(commodityId)) return false

    const avgBasis = this.getAverageBasis(commodityId) ?? 0
    this.credits += this.getPrice(commodityId) * qty
    this.cargo[commodityId] -= qty
    this.cargoBasis[commodityId] -= avgBasis * qty
    this.stock[this.currentSystemId][commodityId] += qty
    return true
  }

  jumpFuelCost(systemId: string, fromSystemId = this.currentSystemId): number {
    const from = SYSTEMS.find((s) => s.id === fromSystemId)!
    const to = SYSTEMS.find((s) => s.id === systemId)!
    return Math.round(Math.hypot(to.x - from.x, to.y - from.y))
  }

  /** Galaxy-date advance for a jump to systemId (fractional days), used both to
   * commit the jump and to animate the clock while the ship is in transit. */
  jumpDateAdvance(systemId: string, fromSystemId = this.currentSystemId): number {
    const from = SYSTEMS.find((s) => s.id === fromSystemId)!
    const to = SYSTEMS.find((s) => s.id === systemId)!
    return Math.hypot(to.x - from.x, to.y - from.y) / GALAXY_DATE_DIVISOR
  }

  travelTo(systemId: string): boolean {
    if (systemId === this.currentSystemId) return false
    const current = SYSTEMS.find((s) => s.id === this.currentSystemId)!
    if (!current.connections.includes(systemId)) return false
    const cost = this.jumpFuelCost(systemId)
    if (cost > this.fuel) return false
    this.fuel -= cost
    this.galaxyDate += this.jumpDateAdvance(systemId)
    this.currentSystemId = systemId
    this.advanceMarketTick()
    return true
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
      }
    }
    // Market rates drift once per jump, but production/consumption is a daily
    // process: run one cycle for each whole galaxy-day that has elapsed, letting
    // any fractional-day remainder carry over to a later jump.
    const targetDay = Math.floor(this.galaxyDate)
    while (this.processedDay < targetDay) {
      for (const system of SYSTEMS) {
        this.runProductionDay(system)
      }
      this.processedDay += 1
    }
  }

  /** A system's per-commodity storage ceiling: its daily production times a fixed factor. */
  maxStorage(systemId: string): number {
    const system = SYSTEMS.find((s) => s.id === systemId)!
    return PRODUCTION_PER_MILLION * system.population * MAX_STORAGE_MULTIPLIER
  }

  /** Units of a commodity a system's market can still take in before hitting its cap. */
  stockSpace(commodityId: CommodityId, systemId = this.currentSystemId): number {
    return Math.max(0, this.maxStorage(systemId) - this.getStock(commodityId, systemId))
  }

  /** How many distinct imported (non-signature) goods a system currently stocks. */
  importedTypeCount(systemId: string): number {
    const stock = this.stock[systemId]
    let count = 0
    for (const commodity of COMMODITIES) {
      if (commodity.id !== systemId && stock[commodity.id] > 0) count += 1
    }
    return count
  }

  /**
   * The multiplier applied to a system's base production rate right now: a flat
   * penalty when it stocks no imported goods, otherwise a compounding bonus for
   * each distinct import on hand. 1.0 would be the unmodified base rate.
   */
  productionModifier(systemId: string): number {
    const importedTypes = this.importedTypeCount(systemId)
    const penalty = importedTypes === 0 ? NO_IMPORTS_PENALTY : 1
    return penalty * Math.pow(VARIETY_BONUS_PER_IMPORT, importedTypes)
  }

  /**
   * One day of economy for a single system: it produces its signature good and
   * its residents consume one random good on hand.
   *
   * Production scales with population, is halved when no imported goods are in
   * stock ({@link NO_IMPORTS_PENALTY}), and gets a compounding bonus for each
   * distinct imported good on hand ({@link VARIETY_BONUS_PER_IMPORT}). Stock is
   * capped per commodity at {@link maxStorage}; the minimum is always 0.
   */
  private runProductionDay(system: StarSystem) {
    const stock = this.stock[system.id]
    const specialtyId = system.id

    const production =
      PRODUCTION_PER_MILLION * system.population * this.productionModifier(system.id)

    const cap = this.maxStorage(system.id)
    stock[specialtyId] = Math.min(cap, stock[specialtyId] + Math.round(production))

    // Residents consume one randomly chosen good that's actually on the shelves.
    const available = COMMODITIES.filter((commodity) => stock[commodity.id] > 0)
    if (available.length > 0) {
      const picked = available[Math.floor(Math.random() * available.length)]
      const consumed = CONSUMPTION_PER_MILLION * system.population
      stock[picked.id] = Math.max(0, stock[picked.id] - consumed)
    }
  }

  /** Temporary flat-rate refuel: pay this to top the tank back up to {@link maxFuel}. */
  refuelCost(): number {
    return REFUEL_COST
  }

  refuel(): boolean {
    if (this.fuel >= this.maxFuel) return false
    if (this.credits < REFUEL_COST) return false
    this.credits -= REFUEL_COST
    this.fuel = this.maxFuel
    return true
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
