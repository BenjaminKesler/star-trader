import Phaser from 'phaser'
import { createTabBar, BOTTOM_BAR_HEIGHT } from '../ui/TabBar'
import { SYSTEMS, formatPopulation } from '../data/systems'
import { gameState } from '../game/GameState'
import { FONT_DISPLAY, FONT_MONO } from '../ui/fonts'
import { formatDelta } from '../ui/format'

const ROW_HEIGHT = 50
/** Y of the top of the column-header row, a full-height band above the list. */
const HEADER_ROW_TOP = 196
/** Y of the vertically-centered column-header labels. */
const HEADER_Y = HEADER_ROW_TOP + ROW_HEIGHT / 2
/** Y of the top of the scrolling system list, just below the header row. */
const ROW_START_Y = HEADER_ROW_TOP + ROW_HEIGHT
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
const HEADER_ROW_COLOR = 0x162238

interface SystemRow {
  bg: Phaser.GameObjects.Rectangle
  name: Phaser.GameObjects.Text
  production: Phaser.GameObjects.Text
  population: Phaser.GameObjects.Text
  /** Up/down arrow marking whether the system is gaining or losing residents. */
  trend: Phaser.GameObjects.Text
  worth: Phaser.GameObjects.Text
}

interface RankedSystem {
  name: string
  productionPercent: number
  population: number
  trend: 'up' | 'down' | 'flat'
  worth: number
}

type SortKey = 'name' | 'productionPercent' | 'population' | 'worth'

/** Each sortable column, with the header label and its natural first-click direction. */
const SORT_COLUMNS: { key: SortKey; label: string; defaultAscending: boolean }[] = [
  { key: 'name', label: 'System', defaultAscending: true },
  { key: 'productionPercent', label: 'Production', defaultAscending: false },
  { key: 'population', label: 'Population', defaultAscending: false },
  { key: 'worth', label: 'Net Worth', defaultAscending: false },
]

/**
 * The Finances page. A pinned header shows the galaxy-wide net worth — the
 * combined credit value of every system's market — above a scrolling list of
 * each system and the net worth of its market, richest first.
 */
export class FinancesScene extends Phaser.Scene {
  private rows: SystemRow[] = []
  /** Systems paired with production %, population and net worth (fixed per visit), sorted by the active column. */
  private ranked: RankedSystem[] = []

  /** The column the list is sorted by, and whether ascending. */
  private sortKey: SortKey = 'worth'
  private sortAscending = false
  /** Clickable column headers, so the active one can show a sort arrow. */
  private headerTexts: Partial<Record<SortKey, Phaser.GameObjects.Text>> = {}

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
        fontFamily: FONT_DISPLAY,
        fontStyle: 'bold',
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
    }))
    this.sortRanked()

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
        fontFamily: FONT_MONO,
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5)
    this.galaxyValue = this.add
      .text(this.worthX, galaxyY + ROW_HEIGHT / 2, '', {
        fontFamily: FONT_MONO,
        fontSize: '24px',
        color: '#9adfff',
      })
      .setOrigin(1, 0.5)

    // Header row: a full-height band matching the data rows, sitting just below
    // the galaxy header and above the scrolling list.
    this.add
      .rectangle(this.tableLeft, HEADER_ROW_TOP, this.tableWidth, ROW_HEIGHT, HEADER_ROW_COLOR)
      .setOrigin(0, 0)

    // Column headers double as sort controls: clicking one sorts the list by that
    // column, and clicking the active column again reverses the direction.
    // Match the data-row font size (22px) but bold, so the header row reads as a heading.
    const headerStyle = { fontFamily: FONT_MONO, fontSize: '22px', fontStyle: 'bold', color: '#7a93b8' }
    const headerX: Record<SortKey, number> = {
      name: this.nameX,
      productionPercent: this.productionX,
      population: this.populationX,
      worth: this.worthX,
    }
    for (const column of SORT_COLUMNS) {
      // The name header is left-aligned; the numeric headers are right-aligned.
      const originX = column.key === 'name' ? 0 : 1
      const header = this.add
        .text(headerX[column.key], HEADER_Y, column.label, headerStyle)
        .setOrigin(originX, 0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.sortBy(column.key))
      this.headerTexts[column.key] = header
    }

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
          fontFamily: FONT_MONO,
          fontSize: '22px',
          color: '#ffffff',
        })
        .setOrigin(0, 0.5)
      const production = this.add
        .text(this.productionX, 0, '', {
          fontFamily: FONT_MONO,
          fontSize: '22px',
          color: '#cccccc',
        })
        .setOrigin(1, 0.5)
      const population = this.add
        .text(this.populationX, 0, '', {
          fontFamily: FONT_MONO,
          fontSize: '22px',
          color: '#cccccc',
        })
        .setOrigin(1, 0.5)
      // Trend arrow sits just to the right of the (right-aligned) population figure.
      const trend = this.add
        .text(this.populationX + TREND_GAP, 0, '', {
          fontFamily: FONT_MONO,
          fontSize: '22px',
          color: '#cccccc',
        })
        .setOrigin(0, 0.5)
      const worth = this.add
        .text(this.worthX, 0, '', {
          fontFamily: FONT_MONO,
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

  /**
   * Sort the list by the given column. Clicking the active column reverses the
   * direction; switching to a new column uses that column's natural default
   * (names A→Z, numbers high→low). Resets scroll and repaints.
   */
  private sortBy(key: SortKey) {
    if (key === this.sortKey) {
      this.sortAscending = !this.sortAscending
    } else {
      this.sortKey = key
      this.sortAscending = SORT_COLUMNS.find((c) => c.key === key)!.defaultAscending
    }
    this.sortRanked()
    this.scrollRow = 0
    this.refresh()
  }

  /** Reorder {@link ranked} in place by the active sort column and direction. */
  private sortRanked() {
    const key = this.sortKey
    const dir = this.sortAscending ? 1 : -1
    this.ranked.sort((a, b) => {
      let cmp: number
      if (key === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else {
        cmp = a[key] - b[key]
      }
      // Break ties by name so the order stays stable and predictable.
      if (cmp === 0) cmp = a.name.localeCompare(b.name)
      return cmp * dir
    })
  }

  /** Mark the active column header with a direction arrow; clear the others. */
  private updateHeaders() {
    for (const column of SORT_COLUMNS) {
      const header = this.headerTexts[column.key]
      if (!header) continue
      if (column.key === this.sortKey) {
        header.setText(`${column.label} ${this.sortAscending ? '▲' : '▼'}`).setColor('#9adfff')
      } else {
        header.setText(column.label).setColor('#7a93b8')
      }
    }
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
    this.updateHeaders()

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
