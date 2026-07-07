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

// --- Initial stock seeding ---
/** A fresh system stocks its own good plus this many randomly chosen imports. */
const STARTING_IMPORTS_MIN = 0
const STARTING_IMPORTS_MAX = 2
/** Each starting good is seeded with this many months of the system's output. */
const STARTING_STOCK_MONTHS_MIN = 3
const STARTING_STOCK_MONTHS_MAX = 9
/** Days per month, used to turn a month count into a day-rate stockpile. */
const DAYS_PER_MONTH = 30

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

/** Returns up to `count` distinct items drawn at random from `items`. */
function pickDistinct<T>(items: T[], count: number): T[] {
  const pool = items.slice()
  const picked: T[] = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  }
  return picked
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
        this.stock[system.id][commodity.id] = 0
      }
      this.seedStartingStock(system)
    }
  }

  /**
   * Seeds a system's opening market: a few months' worth of its own signature
   * good, plus a few months' worth of 0-2 randomly chosen imported goods. The
   * small, variable import count keeps the early-game variety bonus modest.
   */
  private seedStartingStock(system: StarSystem) {
    const stock = this.stock[system.id]
    stock[system.id] = this.startingAmount(system)

    const importCount = randomInt(STARTING_IMPORTS_MIN, STARTING_IMPORTS_MAX)
    const imports = pickDistinct(
      COMMODITIES.filter((c) => c.id !== system.id),
      importCount,
    )
    for (const commodity of imports) {
      stock[commodity.id] = this.startingAmount(system)
    }
  }

  /** A 3-9 month stockpile measured against the system's daily production rate. */
  private startingAmount(system: StarSystem): number {
    const months = randomInt(STARTING_STOCK_MONTHS_MIN, STARTING_STOCK_MONTHS_MAX)
    return months * DAYS_PER_MONTH * PRODUCTION_PER_MILLION * system.population
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
