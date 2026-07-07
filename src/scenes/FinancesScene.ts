import Phaser from 'phaser'
import { createTabBar, BOTTOM_BAR_HEIGHT } from '../ui/TabBar'
import { SYSTEMS, formatPopulation } from '../data/systems'
import { gameState } from '../game/GameState'
import { formatDelta } from '../ui/format'

const ROW_HEIGHT = 50
/** Y of the column-header labels, just above the scrolling list. */
const HEADER_Y = 196
/** Y of the top of the scrolling system list. */
const ROW_START_Y = 224
/** Width of the scrollbar track drawn at the right edge of the table. */
const SCROLLBAR_WIDTH = 10
/** Gap kept below the list before the bottom tab bar. */
const BAND_BOTTOM_GAP = 30

const TABLE_MARGIN = 40
const DESIGN_TABLE_WIDTH = 1000
/** Inset from each edge of the table to the name / worth columns. */
const COLUMN_INSET = 24
/** Pixels from the right-aligned population figure to its trend arrow. */
const TREND_GAP = 10

/** Arrow glyph and colour for each population trend. */
const TREND_STYLE: Record<'up' | 'down' | 'flat', { glyph: string; color: string }> = {
  up: { glyph: '▲', color: '#44ff88' },
  down: { glyph: '▼', color: '#ff8844' },
  flat: { glyph: '', color: '#cccccc' },
}

const ROW_COLOR_EVEN = 0x0c1424
const ROW_COLOR_ODD = 0x121d33
const GALAXY_ROW_COLOR = 0x1c2c44

interface SystemRow {
  bg: Phaser.GameObjects.Rectangle
  name: Phaser.GameObjects.Text
  production: Phaser.GameObjects.Text
  population: Phaser.GameObjects.Text
  /** Up/down arrow marking whether the system is gaining or losing residents. */
  trend: Phaser.GameObjects.Text
  worth: Phaser.GameObjects.Text
}

/**
 * The Finances page. A pinned header shows the galaxy-wide net worth — the
 * combined credit value of every system's market — above a scrolling list of
 * each system and the net worth of its market, richest first.
 */
export class FinancesScene extends Phaser.Scene {
  private rows: SystemRow[] = []
  /** Systems paired with production %, population and net worth, sorted richest-first (fixed per visit). */
  private ranked: {
    name: string
    productionPercent: number
    population: number
    trend: 'up' | 'down' | 'flat'
    worth: number
  }[] = []

  private galaxyValue!: Phaser.GameObjects.Text
  private scrollTrack!: Phaser.GameObjects.Rectangle
  private scrollThumb!: Phaser.GameObjects.Rectangle

  /** Index of the top system row currently shown. */
  private scrollRow = 0
  /** How many rows fit in the scroll band at the current window height. */
  private visibleCapacity = 1

  private nameX = 0
  private productionX = 0
  private populationX = 0
  private worthX = 0
  private tableLeft = 0
  private tableWidth = 0

  constructor() {
    super('FinancesScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#000010')
    createTabBar(this, this.scene.key)

    this.rows = []
    this.scrollRow = 0

    this.add
      .text(this.scale.width / 2, 75, 'Finances', {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0)

    this.ranked = SYSTEMS.map((s) => ({
      name: s.name,
      productionPercent: Math.round((gameState.productionModifier(s.id) - 1) * 100),
      population: gameState.getPopulation(s.id),
      trend: gameState.getPopulationTrend(s.id),
      worth: Math.round(gameState.systemNetWorth(s.id)),
    })).sort((a, b) => b.worth - a.worth)

    // Table geometry: capped at the design width and centered.
    this.tableWidth = Math.min(DESIGN_TABLE_WIDTH, this.scale.width - TABLE_MARGIN * 2)
    this.tableLeft = (this.scale.width - this.tableWidth) / 2
    const tableRight = this.tableLeft + this.tableWidth
    this.nameX = this.tableLeft + COLUMN_INSET
    this.worthX = tableRight - COLUMN_INSET
    // Production and population sit between the name and worth columns, each
    // right-aligned so their numbers line up in tidy stacks.
    this.productionX = this.tableLeft + this.tableWidth * 0.52
    this.populationX = this.tableLeft + this.tableWidth * 0.76

    // Pinned galaxy net-worth header, always visible above the list.
    const galaxyY = 140
    this.add
      .rectangle(this.tableLeft, galaxyY, this.tableWidth, ROW_HEIGHT, GALAXY_ROW_COLOR)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x3a5a8a)
    this.add
      .text(this.nameX, galaxyY + ROW_HEIGHT / 2, 'Galaxy Net Worth', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5)
    this.galaxyValue = this.add
      .text(this.worthX, galaxyY + ROW_HEIGHT / 2, '', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#9adfff',
      })
      .setOrigin(1, 0.5)

    // Column headers for the scrolling list below.
    const headerStyle = { fontFamily: 'monospace', fontSize: '16px', color: '#7a93b8' }
    this.add.text(this.nameX, HEADER_Y, 'System', headerStyle).setOrigin(0, 0.5)
    this.add.text(this.productionX, HEADER_Y, 'Production', headerStyle).setOrigin(1, 0.5)
    this.add.text(this.populationX, HEADER_Y, 'Population', headerStyle).setOrigin(1, 0.5)
    this.add.text(this.worthX, HEADER_Y, 'Net Worth', headerStyle).setOrigin(1, 0.5)

    // How many system rows fit between the header and the bottom bar.
    const bandBottom = this.scale.height - BOTTOM_BAR_HEIGHT - BAND_BOTTOM_GAP
    this.visibleCapacity = Math.max(1, Math.floor((bandBottom - ROW_START_Y) / ROW_HEIGHT))

    // One reusable row object per visible slot; content is repainted on scroll.
    const slots = Math.min(this.visibleCapacity, this.ranked.length)
    for (let i = 0; i < slots; i++) {
      const bg = this.add
        .rectangle(this.tableLeft, ROW_START_Y + i * ROW_HEIGHT, this.tableWidth, ROW_HEIGHT, ROW_COLOR_EVEN)
        .setOrigin(0, 0)
      const name = this.add
        .text(this.nameX, 0, '', {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#ffffff',
        })
        .setOrigin(0, 0.5)
      const production = this.add
        .text(this.productionX, 0, '', {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#cccccc',
        })
        .setOrigin(1, 0.5)
      const population = this.add
        .text(this.populationX, 0, '', {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#cccccc',
        })
        .setOrigin(1, 0.5)
      // Trend arrow sits just to the right of the (right-aligned) population figure.
      const trend = this.add
        .text(this.populationX + TREND_GAP, 0, '', {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#cccccc',
        })
        .setOrigin(0, 0.5)
      const worth = this.add
        .text(this.worthX, 0, '', {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#cccccc',
        })
        .setOrigin(1, 0.5)
      this.rows.push({ bg, name, production, population, trend, worth })
    }

    // Scrollbar just inside the right edge of the table.
    const scrollbarX = tableRight - SCROLLBAR_WIDTH - 4
    this.scrollTrack = this.add
      .rectangle(scrollbarX, ROW_START_Y, SCROLLBAR_WIDTH, ROW_HEIGHT, 0x1a2740)
      .setOrigin(0, 0)
    this.scrollThumb = this.add
      .rectangle(scrollbarX, ROW_START_Y, SCROLLBAR_WIDTH, ROW_HEIGHT, 0x4a6a99)
      .setOrigin(0, 0)

    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.scrollBy(dy > 0 ? 1 : -1)
    })

    this.refresh()

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this)
    })
  }

  private handleResize() {
    this.scene.restart()
  }

  private maxScrollRow(): number {
    return Math.max(0, this.ranked.length - this.visibleCapacity)
  }

  private scrollBy(rows: number) {
    const next = Phaser.Math.Clamp(this.scrollRow + rows, 0, this.maxScrollRow())
    if (next !== this.scrollRow) {
      this.scrollRow = next
      this.refresh()
    }
  }

  private refresh() {
    this.galaxyValue.setText(`${Math.round(gameState.galaxyNetWorth).toLocaleString()}cr`)

    const windowStart = this.scrollRow
    this.rows.forEach((row, i) => {
      const entry = this.ranked[windowStart + i]
      const rowTop = ROW_START_Y + i * ROW_HEIGHT
      const rowCenterY = rowTop + ROW_HEIGHT / 2
      row.bg.setY(rowTop).setFillStyle(i % 2 === 0 ? ROW_COLOR_EVEN : ROW_COLOR_ODD)
      row.name.setY(rowCenterY).setText(entry.name)
      const pct = entry.productionPercent
      row.production
        .setY(rowCenterY)
        .setText(formatDelta(pct))
        .setColor(pct > 0 ? '#44ff88' : pct < 0 ? '#ff8844' : '#cccccc')
      row.population.setY(rowCenterY).setText(formatPopulation(entry.population))
      const trend = TREND_STYLE[entry.trend]
      row.trend.setY(rowCenterY).setText(trend.glyph).setColor(trend.color)
      row.worth.setY(rowCenterY).setText(`${entry.worth.toLocaleString()}cr`)
    })

    this.updateScrollbar()
  }

  /** Size and place the scrollbar thumb, or hide the bar when nothing overflows. */
  private updateScrollbar() {
    const trackHeight = this.visibleCapacity * ROW_HEIGHT
    const overflow = this.ranked.length > this.visibleCapacity
    this.scrollTrack.setVisible(overflow)
    this.scrollThumb.setVisible(overflow)
    if (!overflow) return

    const thumbHeight = Math.max(30, (trackHeight * this.visibleCapacity) / this.ranked.length)
    const maxScroll = this.maxScrollRow()
    const progress = maxScroll > 0 ? this.scrollRow / maxScroll : 0
    this.scrollThumb.setSize(SCROLLBAR_WIDTH, thumbHeight).setY(ROW_START_Y + progress * (trackHeight - thumbHeight))
  }
}
