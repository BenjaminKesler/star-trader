import { COMMODITIES, type CommodityId } from '../data/commodities'
import { SYSTEMS, type StarSystem } from '../data/systems'
import { rankForNetWorth, type Rank } from '../data/ranks'
import {
  CARGO_BAY_CAPACITY,
  ENGINE_SPEED_BONUS,
  EXPANSION_BY_ID,
  FUEL_TANK_CAPACITY,
  type ExpansionId,
} from '../data/expansions'

const GALAXY_RATE_MIN = 0.85
const GALAXY_RATE_MAX = 1.3
const LOCAL_RATE_MIN = 0.75
const LOCAL_RATE_MAX = 1.25

const BOOM_CRASH_CHANCE = 0.12
const SMALL_MOVE_RANGE = 0.03
const BOOM_CRASH_RANGE = 0.15
const MEAN_REVERSION = 0.05

// --- Local supply pressure ---
// Each day a system's local rate is nudged by how much of the commodity it holds,
// relative to its storage cap: a well-stocked market drifts cheaper, a bare one
// drifts pricier. The nudge is capped at LOCAL_SUPPLY_SWING per day either way.
const LOCAL_SUPPLY_SWING = 0.03
/** Fill fraction at which supply pressure is neutral; above it prices soften, below it they firm. */
const LOCAL_SUPPLY_NEUTRAL_FILL = 0.1

// --- Population migration ---
// People drift between systems in slow waves. Each wave moves a share of its
// source's population to a destination over one-to-two years, following an
// S-curve: the flow starts as a trickle, swells to a peak, then tapers off.
/** Chance per day that a fresh migration wave begins, while under the active cap. */
const MIGRATION_SPAWN_CHANCE = 0.02
/** Most migration waves that can be underway at once. */
const MAX_ACTIVE_MIGRATIONS = 6
/** Fraction of a source system's population a single wave relocates over its life. */
const MIGRATION_POP_FRACTION_MIN = 0.02
const MIGRATION_POP_FRACTION_MAX = 0.08
/** A wave plays out over this many days — a slow one-to-two-year swing. */
const MIGRATION_DURATION_MIN = 365
const MIGRATION_DURATION_MAX = 730
/** A system never migrates below this floor, in millions. */
const MIGRATION_MIN_POP = 1
/** Destination tilt: the wealthiest system is at most (1 + this)× as attractive as the poorest. */
const MIGRATION_PROSPERITY_TILT = 0.5

// --- Organic galaxy growth ---
// The galaxy's headcount creeps upward, but only as fast as its wealth allows:
// growth runs at its peak rate while wealth-per-capita holds at the opening
// baseline and throttles toward zero as population outruns that wealth.
/** Peak galaxy-wide annual growth, reached only when wealth-per-capita is at baseline. */
const MAX_ANNUAL_GROWTH = 0.008

// --- Migration momentum, trend & price impact ---
/** EMA weight on each day's net migration; smooths the per-system trend signal. */
const MOMENTUM_SMOOTHING = 0.1
/** |per-day net-migration fraction| below this reads as a steady population (no arrow). */
const POP_TREND_FLAT = 8e-6
/** Turns a system's per-day net-migration fraction into a local-price nudge. */
const MIGRATION_PRICE_SENSITIVITY = 100
/** Hard cap on that per-day migration price nudge, in rate units. */
const MIGRATION_PRICE_CAP = 0.02

// --- Player footprint on the galaxy ---
// Trading in a system leaves a decaying mark of "economic vibrancy" there, which
// draws migrants. The pull is scaled by the player's prominence, so it is barely
// perceptible while the player is small and grows to reshape the galaxy late-game.
/** Days for a system's accumulated player trade influence to halve. */
const PLAYER_INFLUENCE_HALFLIFE = 180
/** Net worth at which the player is "half" as prominent as they will ever effectively be. */
const PLAYER_PROMINENCE_HALF = 200_000
/**
 * At full prominence, the player can steer a migration "budget" worth this many×
 * the galaxy's entire baseline pull toward the systems they trade in — enough,
 * late-game, to grow a favoured system into a boomtown. Scaled by prominence, so
 * it is imperceptible early on.
 */
const PLAYER_PULL_SHARE = 1.5

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

/** Cargo hold size of a bare ship, before any Cargo Bay expansions. */
const BASE_CARGO_CAPACITY = 20
/** Fuel tank size of a bare ship, before any Fuel Tank expansions. */
const BASE_MAX_FUEL = 5000
/** Expansion bays on the starting ship — the ceiling on installed expansions. */
const STARTING_EXPANSION_BAYS = 2

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

function stepRate(current: number, min: number, max: number, bias = 0): number {
  const isBoomOrCrash = Math.random() < BOOM_CRASH_CHANCE
  const range = isBoomOrCrash ? BOOM_CRASH_RANGE : SMALL_MOVE_RANGE
  const delta = (Math.random() * 2 - 1) * range
  const reversion = (1 - current) * MEAN_REVERSION
  const next = current + delta + reversion + bias
  return Math.min(max, Math.max(min, next))
}

/**
 * Per-day price pressure from a system's stock of a commodity: markets holding a
 * glut drift cheaper, bare markets drift pricier. Bounded to ±LOCAL_SUPPLY_SWING.
 */
function supplyBias(fillFraction: number): number {
  const raw = (1 - fillFraction / LOCAL_SUPPLY_NEUTRAL_FILL) * LOCAL_SUPPLY_SWING
  return Math.min(LOCAL_SUPPLY_SWING, Math.max(-LOCAL_SUPPLY_SWING, raw))
}

/** Smoothstep S-curve: 0 at t≤0, 1 at t≥1, with a flat (zero-slope) start and end. */
function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

/** Picks one item at random, each item's odds proportional to its weight. */
function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return items[i]
  }
  return items[items.length - 1]
}

/** One in-progress migration wave: a share of `from`'s people relocating to `to`. */
interface Migration {
  from: string
  to: string
  /** Total population, in millions, the wave will relocate over its whole life. */
  total: number
  /** Galaxy-day the wave began. */
  startDay: number
  /** Length of the wave in days. */
  durationDays: number
  /** Population moved so far, in millions; tracked so the S-curve stays exact. */
  moved: number
}

class GameStateImpl {
  companyName = 'Unnamed Trading Co.'
  shipName = 'Rusty Hauler'
  credits = 1000
  fuel = BASE_MAX_FUEL
  currentSystemId = SYSTEMS[0].id
  galaxyDate = 0
  /** Whole galaxy-days already run through production/consumption. */
  private processedDay = 0
  /** Total expansion bays on the ship; installed expansions can't exceed this. */
  expansionBays = STARTING_EXPANSION_BAYS
  /** How many of each expansion are currently installed (each uses one bay). */
  installedExpansions: Record<ExpansionId, number> = { 'fuel-tank': 0, 'engine-upgrade': 0, 'cargo-bay': 0 }
  cargo: CargoHold = emptyCargo()
  private cargoBasis: CargoHold = emptyCargo()

  galaxyRates: Record<CommodityId, number> = {} as Record<CommodityId, number>
  localRates: RateTable = {}
  stock: RateTable = {}
  /** Live resident population per system, in millions; seeded from each system's authored value. */
  populations: Record<string, number> = {}
  /** Migration waves currently moving people between systems. */
  private migrations: Migration[] = []
  /** Opening galaxy wealth-per-capita; organic growth is throttled against this. */
  private baselineWorthPerCapita = 1
  /** EMA of each system's daily net migration (millions/day, + = inflow); drives trend arrows and price. */
  private migrationMomentum: Record<string, number> = {}
  /** Decaying record of how much the player has traded in each system. */
  private playerInfluence: Record<string, number> = {}

  constructor() {
    for (const commodity of COMMODITIES) {
      this.galaxyRates[commodity.id] = 1
    }
    for (const system of SYSTEMS) {
      this.populations[system.id] = system.population
      this.migrationMomentum[system.id] = 0
      this.playerInfluence[system.id] = 0
      this.localRates[system.id] = {} as Record<CommodityId, number>
      this.stock[system.id] = {} as Record<CommodityId, number>
      for (const commodity of COMMODITIES) {
        this.localRates[system.id][commodity.id] = 1
        this.stock[system.id][commodity.id] = 0
      }
      this.seedStartingStock(system)
    }
    const startingPop = this.galaxyPopulation
    if (startingPop > 0) this.baselineWorthPerCapita = this.galaxyNetWorth / startingPop
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
    return months * DAYS_PER_MONTH * PRODUCTION_PER_MILLION * this.getPopulation(system.id)
  }

  /** A system's live resident population, in millions. */
  getPopulation(systemId: string): number {
    return this.populations[systemId]
  }

  /** Total living population across every system, in millions. */
  get galaxyPopulation(): number {
    return SYSTEMS.reduce((sum, s) => sum + this.populations[s.id], 0)
  }

  /** Whether a system is currently gaining, losing, or holding population, for trend arrows. */
  getPopulationTrend(systemId: string): 'up' | 'down' | 'flat' {
    const pop = this.getPopulation(systemId)
    if (pop <= 0) return 'flat'
    const rate = this.migrationMomentum[systemId] / pop
    if (rate > POP_TREND_FLAT) return 'up'
    if (rate < -POP_TREND_FLAT) return 'down'
    return 'flat'
  }

  /**
   * A small per-day price nudge from a system's migration flow: inbound waves
   * firm prices, outbound waves soften them. Bounded to ±{@link MIGRATION_PRICE_CAP}.
   */
  private migrationPriceBias(systemId: string): number {
    const pop = this.getPopulation(systemId)
    if (pop <= 0) return 0
    const rate = this.migrationMomentum[systemId] / pop
    return Math.min(MIGRATION_PRICE_CAP, Math.max(-MIGRATION_PRICE_CAP, rate * MIGRATION_PRICE_SENSITIVITY))
  }

  /**
   * How much the player's economic weight sways the galaxy, from ~0 while small
   * to ~1 once wealthy. Used to scale the player's influence over migration so
   * their footprint is faint early-game and pronounced late-game.
   */
  get playerProminence(): number {
    const worth = this.netWorth
    return worth / (worth + PLAYER_PROMINENCE_HALF)
  }

  get cargoUsed(): number {
    return Object.values(this.cargo).reduce((sum, qty) => sum + qty, 0)
  }

  get cargoFree(): number {
    return this.cargoCapacity - this.cargoUsed
  }

  /** Cargo capacity: the bare hull plus every installed Cargo Bay. */
  get cargoCapacity(): number {
    return BASE_CARGO_CAPACITY + this.installedExpansions['cargo-bay'] * CARGO_BAY_CAPACITY
  }

  /** Fuel capacity: the bare tank plus every installed Fuel Tank. */
  get maxFuel(): number {
    return BASE_MAX_FUEL + this.installedExpansions['fuel-tank'] * FUEL_TANK_CAPACITY
  }

  /** Travel-time divisor from engines: each Engine Upgrade shortens jumps. */
  get travelSpeedMultiplier(): number {
    return 1 + this.installedExpansions['engine-upgrade'] * ENGINE_SPEED_BONUS
  }

  /** Expansion bays already occupied by installed expansions. */
  get usedBays(): number {
    return Object.values(this.installedExpansions).reduce((sum, n) => sum + n, 0)
  }

  /** Expansion bays still open for new expansions. */
  get freeBays(): number {
    return this.expansionBays - this.usedBays
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
    this.playerInfluence[this.currentSystemId] += cost
    return true
  }

  sell(commodityId: CommodityId, qty: number): boolean {
    if (qty <= 0) return false
    if (qty > this.cargo[commodityId]) return false
    if (qty > this.stockSpace(commodityId)) return false

    const avgBasis = this.getAverageBasis(commodityId) ?? 0
    const proceeds = this.getPrice(commodityId) * qty
    this.credits += proceeds
    this.cargo[commodityId] -= qty
    this.cargoBasis[commodityId] -= avgBasis * qty
    this.stock[this.currentSystemId][commodityId] += qty
    this.playerInfluence[this.currentSystemId] += proceeds
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
    return Math.hypot(to.x - from.x, to.y - from.y) / GALAXY_DATE_DIVISOR / this.travelSpeedMultiplier
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
      const cap = this.maxStorage(system.id)
      // A system gaining people bids prices up; one bleeding them lets prices sag.
      const migBias = this.migrationPriceBias(system.id)
      for (const commodity of COMMODITIES) {
        const fillFraction = cap > 0 ? this.getStock(commodity.id, system.id) / cap : 0
        this.localRates[system.id][commodity.id] = stepRate(
          this.localRates[system.id][commodity.id],
          LOCAL_RATE_MIN,
          LOCAL_RATE_MAX,
          supplyBias(fillFraction) + migBias,
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
      const popBefore: Record<string, number> = {}
      for (const system of SYSTEMS) popBefore[system.id] = this.populations[system.id]
      this.runMigrationDay(this.processedDay)
      this.updateMigrationMomentum(popBefore)
      this.runGalaxyGrowthDay()
      this.decayPlayerInfluence()
      this.processedDay += 1
    }
  }

  /** Folds today's net migration (population change, growth excluded) into each system's momentum EMA. */
  private updateMigrationMomentum(popBefore: Record<string, number>) {
    for (const system of SYSTEMS) {
      const delta = this.populations[system.id] - popBefore[system.id]
      this.migrationMomentum[system.id] +=
        MOMENTUM_SMOOTHING * (delta - this.migrationMomentum[system.id])
    }
  }

  /** Ages the player's trade footprint everywhere by one day's decay. */
  private decayPlayerInfluence() {
    const decay = Math.pow(0.5, 1 / PLAYER_INFLUENCE_HALFLIFE)
    for (const system of SYSTEMS) this.playerInfluence[system.id] *= decay
  }

  /**
   * One day of population movement: every active migration wave advances along
   * its S-curve (a trickle that swells to a peak then tapers), and — while under
   * the concurrency cap — a fresh wave may begin.
   */
  private runMigrationDay(day: number) {
    const stillActive: Migration[] = []
    for (const m of this.migrations) {
      const t = (day - m.startDay + 1) / m.durationDays
      const targetCumulative = m.total * smoothstep(t)
      // Move only the increment the S-curve calls for today, and never drain a
      // source below its floor.
      const available = this.getPopulation(m.from) - MIGRATION_MIN_POP
      const delta = Math.max(0, Math.min(targetCumulative - m.moved, available))
      if (delta > 0) {
        this.populations[m.from] -= delta
        this.populations[m.to] += delta
        m.moved += delta
      }
      if (t < 1) stillActive.push(m)
    }
    this.migrations = stillActive

    if (this.migrations.length < MAX_ACTIVE_MIGRATIONS && Math.random() < MIGRATION_SPAWN_CHANCE) {
      this.spawnMigration(day)
    }
  }

  /**
   * Kicks off a new migration wave, roughly on a gravity model: the source is
   * drawn weighted by population (bigger systems send more people), and the
   * destination weighted by population too — with a slight extra tilt toward
   * well-to-do systems. Sizing the wave by the smaller of the two populations
   * keeps the total sensible for both ends: a hub can't flood a hamlet, and a
   * hamlet can't drain a hub.
   */
  private spawnMigration(day: number) {
    const eligible = SYSTEMS.filter((s) => this.getPopulation(s.id) > MIGRATION_MIN_POP)
    if (eligible.length < 2) return
    const source = weightedPick(eligible, eligible.map((s) => this.getPopulation(s.id)))

    const dests = SYSTEMS.filter((s) => s.id !== source.id)
    const worths = dests.map((s) => this.systemNetWorth(s.id))
    const maxWorth = Math.max(...worths, 1)
    // Baseline gravity: population, tilted slightly toward the well-to-do.
    const baseWeights = dests.map(
      (s, i) => this.getPopulation(s.id) * (1 + MIGRATION_PROSPERITY_TILT * (worths[i] / maxWorth)),
    )
    // The player steers a share of the galaxy's total pull toward the systems
    // they trade in — a budget added on top of gravity, scaled by prominence so
    // it is negligible while small and galaxy-shaping once wealthy.
    const totalBase = baseWeights.reduce((sum, w) => sum + w, 0)
    const totalInfluence = dests.reduce((sum, s) => sum + this.playerInfluence[s.id], 0)
    const budget = this.playerProminence * PLAYER_PULL_SHARE * totalBase
    const destWeights = baseWeights.map(
      (w, i) =>
        w + (totalInfluence > 0 ? budget * (this.playerInfluence[dests[i].id] / totalInfluence) : 0),
    )
    const dest = weightedPick(dests, destWeights)

    const fraction =
      MIGRATION_POP_FRACTION_MIN +
      Math.random() * (MIGRATION_POP_FRACTION_MAX - MIGRATION_POP_FRACTION_MIN)
    const anchorPop = Math.min(this.getPopulation(source.id), this.getPopulation(dest.id))
    this.migrations.push({
      from: source.id,
      to: dest.id,
      total: anchorPop * fraction,
      startDay: day,
      durationDays: randomInt(MIGRATION_DURATION_MIN, MIGRATION_DURATION_MAX),
      moved: 0,
    })
  }

  /**
   * A very slight galaxy-wide population increase, spread across systems in
   * proportion to their current size. The rate peaks at {@link MAX_ANNUAL_GROWTH}
   * while wealth-per-capita holds at its opening baseline and throttles toward
   * zero as population outruns that wealth.
   */
  private runGalaxyGrowthDay() {
    const totalPop = this.galaxyPopulation
    if (totalPop <= 0 || this.baselineWorthPerCapita <= 0) return
    const worthPerCapita = this.galaxyNetWorth / totalPop
    const capacityRatio = Math.min(1, worthPerCapita / this.baselineWorthPerCapita)
    const dailyRate = (MAX_ANNUAL_GROWTH / DAYS_PER_YEAR) * capacityRatio
    if (dailyRate <= 0) return
    for (const system of SYSTEMS) {
      this.populations[system.id] += this.populations[system.id] * dailyRate
    }
  }

  /** A system's per-commodity storage ceiling: its daily production times a fixed factor. */
  maxStorage(systemId: string): number {
    return PRODUCTION_PER_MILLION * this.getPopulation(systemId) * MAX_STORAGE_MULTIPLIER
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
      PRODUCTION_PER_MILLION * this.getPopulation(system.id) * this.productionModifier(system.id)

    const cap = this.maxStorage(system.id)
    stock[specialtyId] = Math.min(cap, stock[specialtyId] + Math.round(production))

    // Residents consume one randomly chosen good that's actually on the shelves.
    const available = COMMODITIES.filter((commodity) => stock[commodity.id] > 0)
    if (available.length > 0) {
      const picked = available[Math.floor(Math.random() * available.length)]
      const consumed = Math.round(CONSUMPTION_PER_MILLION * this.getPopulation(system.id))
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

  /** Credits refunded for selling one installed expansion back: half its price. */
  expansionRefund(id: ExpansionId): number {
    return Math.floor(EXPANSION_BY_ID[id].price / 2)
  }

  /** Whether an expansion can be installed right now: a free bay and the credits. */
  canInstallExpansion(id: ExpansionId): boolean {
    return this.freeBays > 0 && this.credits >= EXPANSION_BY_ID[id].price
  }

  /** Whether an installed expansion can be sold back without stranding cargo. */
  canRemoveExpansion(id: ExpansionId): boolean {
    if (this.installedExpansions[id] <= 0) return false
    // Removing a Cargo Bay shrinks the hold; refuse if that would leave cargo
    // over the new capacity (fuel, by contrast, simply spills and is clamped).
    if (id === 'cargo-bay' && this.cargoUsed > this.cargoCapacity - CARGO_BAY_CAPACITY) return false
    return true
  }

  installExpansion(id: ExpansionId): boolean {
    if (!this.canInstallExpansion(id)) return false
    this.credits -= EXPANSION_BY_ID[id].price
    this.installedExpansions[id] += 1
    return true
  }

  removeExpansion(id: ExpansionId): boolean {
    if (!this.canRemoveExpansion(id)) return false
    this.installedExpansions[id] -= 1
    this.credits += this.expansionRefund(id)
    // A removed Fuel Tank can drop maxFuel below the current level; spill the rest.
    if (this.fuel > this.maxFuel) this.fuel = this.maxFuel
    return true
  }
}

export const gameState = new GameStateImpl()
