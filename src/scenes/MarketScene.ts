import Phaser from 'phaser'
import { COMMODITIES, type Commodity } from '../data/commodities'
import { SYSTEMS, formatPopulation } from '../data/systems'
import { gameState } from '../game/GameState'
import { BOTTOM_BAR_HEIGHT, CREDITS_NAME, createTabBar } from '../ui/TabBar'
import { formatDelta } from '../ui/format'

const ROW_HEIGHT = 60
const ROW_START_Y = 240

/** Vertical room reserved below the scrolling table for the upgrade footer. */
const FOOTER_RESERVE = 120
/** Width of the scrollbar track drawn at the right edge of the table. */
const SCROLLBAR_WIDTH = 10
/** Inner padding (screen px) between the hover flyout's text and its border. */
const FLYOUT_PAD_X = 12
const FLYOUT_PAD_Y = 8

// Column offsets are measured from the left edge of the table, designed for
// a table this wide. On narrower windows they're scaled down proportionally;
// on wider windows the table is capped at this width and centered.
const DESIGN_TABLE_WIDTH = 1830
const TABLE_MARGIN = 30

const NAME_OFFSET = 30
const DIVIDER1_OFFSET = 315
const PRICE_OFFSET = 360
const STOCK_OFFSET = 570
const BUY_ONE_OFFSET = 705
const BUY_ALL_OFFSET = 818
const DIVIDER2_OFFSET = 1095
const BASIS_OFFSET = 1140
const INVENTORY_OFFSET = 1350
const SELL_ONE_OFFSET = 1485
const SELL_ALL_OFFSET = 1598

/** Padding (design units) kept between the longest commodity name and divider 1. */
const NAME_COL_GAP = 45

const ROW_COLOR_EVEN = 0x0c1424
const ROW_COLOR_ODD = 0x121d33

export class MarketScene extends Phaser.Scene {
  private hud!: Phaser.GameObjects.Text
  private nameTexts: Partial<Record<string, Phaser.GameObjects.Text>> = {}
  private priceTexts: Partial<Record<string, Phaser.GameObjects.Text>> = {}
  private stockTexts: Partial<Record<string, Phaser.GameObjects.Text>> = {}
  private basisTexts: Partial<Record<string, Phaser.GameObjects.Text>> = {}
  private inventoryTexts: Partial<Record<string, Phaser.GameObjects.Text>> = {}
  private buyOneButtons: Partial<Record<string, Phaser.GameObjects.Text>> = {}
  private buyAllButtons: Partial<Record<string, Phaser.GameObjects.Text>> = {}
  private sellOneButtons: Partial<Record<string, Phaser.GameObjects.Text>> = {}
  private sellAllButtons: Partial<Record<string, Phaser.GameObjects.Text>> = {}
  private rowBackgrounds: Partial<Record<string, Phaser.GameObjects.Rectangle>> = {}
  private divider1!: Phaser.GameObjects.Rectangle
  private divider2!: Phaser.GameObjects.Rectangle
  private upgradeButton!: Phaser.GameObjects.Text
  private scrollTrack!: Phaser.GameObjects.Rectangle
  private scrollThumb!: Phaser.GameObjects.Rectangle
  private flyout!: Phaser.GameObjects.Container
  private flyoutBg!: Phaser.GameObjects.Rectangle
  private flyoutText!: Phaser.GameObjects.Text
  private ctrlKey!: Phaser.Input.Keyboard.Key
  private shiftKey!: Phaser.Input.Keyboard.Key

  /** Index (into the visible-commodity list) of the top row currently shown. */
  private scrollRow = 0
  /** How many rows fit in the scroll band at the current window height. */
  private visibleCapacity = 1
  /** Fixed Y for the upgrade footer, just above the bottom tab bar. */
  private footerY = 0

  constructor() {
    super('MarketScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#000010')
    this.priceTexts = {}
    this.stockTexts = {}
    this.basisTexts = {}
    this.inventoryTexts = {}
    this.rowBackgrounds = {}

    const here = SYSTEMS.find((s) => s.id === gameState.currentSystemId)!

    createTabBar(this, this.scene.key)

    this.add
      .text(this.scale.width / 2, 75, `${here.name} Market — Pop. ${formatPopulation(here.population)}`, {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0)

    this.hud = this.add.text(30, 70, '', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#9adfff',
    })

    this.ctrlKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL)
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT)
    this.input.keyboard!.on('keydown-CTRL', () => this.refresh())
    this.input.keyboard!.on('keyup-CTRL', () => this.refresh())
    this.input.keyboard!.on('keydown-SHIFT', () => this.refresh())
    this.input.keyboard!.on('keyup-SHIFT', () => this.refresh())

    // Widen the name column to fit the longest commodity name. Names are
    // measured at the design font size (27px), so widths come out in the same
    // "design units" as the column offsets; every column from divider 1 rightward
    // then slides over by the extra room the names need.
    const measurer = this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '27px' }).setVisible(false)
    let widestName = 0
    for (const commodity of COMMODITIES) {
      measurer.setText(commodity.name)
      widestName = Math.max(widestName, measurer.width)
    }
    measurer.destroy()
    const columnShift = Math.max(0, NAME_OFFSET + widestName + NAME_COL_GAP - DIVIDER1_OFFSET)
    const designWidth = DESIGN_TABLE_WIDTH + columnShift

    const availableWidth = this.scale.width - TABLE_MARGIN * 2
    const tableWidth = Math.min(designWidth, availableWidth)
    const columnScale = tableWidth / designWidth
    const tableLeft = (this.scale.width - tableWidth) / 2
    const tableRight = tableLeft + tableWidth

    // The table scrolls: rows fill the band between the header and the fixed
    // footer, and only a window of them is shown at once.
    this.footerY = this.scale.height - BOTTOM_BAR_HEIGHT - 45
    const bandBottom = this.scale.height - BOTTOM_BAR_HEIGHT - FOOTER_RESERVE
    this.visibleCapacity = Math.max(1, Math.floor((bandBottom - ROW_START_Y) / ROW_HEIGHT))
    this.scrollRow = 0

    // The name column keeps its left offset; everything from divider 1 rightward
    // is pushed over by columnShift.
    const colX = (offset: number) =>
      tableLeft + (offset + (offset >= DIVIDER1_OFFSET ? columnShift : 0)) * columnScale
    const nameX = colX(NAME_OFFSET)
    const divider1X = colX(DIVIDER1_OFFSET)
    const priceX = colX(PRICE_OFFSET)
    const stockX = colX(STOCK_OFFSET)
    const buyOneX = colX(BUY_ONE_OFFSET)
    const buyAllX = colX(BUY_ALL_OFFSET)
    const divider2X = colX(DIVIDER2_OFFSET)
    const basisX = colX(BASIS_OFFSET)
    const inventoryX = colX(INVENTORY_OFFSET)
    const sellOneX = colX(SELL_ONE_OFFSET)
    const sellAllX = colX(SELL_ALL_OFFSET)

    // Font size and button padding shrink with the columns so buttons never
    // overlap their neighbors on narrow windows.
    const rowFontSize = `${Math.round(27 * columnScale)}px`
    const buttonPadding = { x: Math.round(12 * columnScale), y: Math.round(6 * columnScale) }

    COMMODITIES.forEach((commodity, i) => {
      const y = ROW_START_Y + i * ROW_HEIGHT

      const rowBg = this.add
        .rectangle(tableLeft, y - 9, tableRight - tableLeft, ROW_HEIGHT, ROW_COLOR_EVEN)
        .setOrigin(0, 0)
      this.rowBackgrounds[commodity.id] = rowBg

      const nameText = this.add.text(nameX, y, commodity.name, {
        fontFamily: 'monospace',
        fontSize: rowFontSize,
        color: '#ffffff',
      })
      nameText
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: false })
        .on('pointerover', () => this.showCommodityFlyout(commodity, nameText))
        .on('pointerout', () => this.hideFlyout())
      this.nameTexts[commodity.id] = nameText

      const priceText = this.add
        .text(priceX, y, '', {
          fontFamily: 'monospace',
          fontSize: rowFontSize,
          color: '#cccccc',
        })
        .setOrigin(0, 0.5)
      this.priceTexts[commodity.id] = priceText

      const stockText = this.add
        .text(stockX, y, '', {
          fontFamily: 'monospace',
          fontSize: rowFontSize,
          color: '#cccccc',
        })
        .setOrigin(0, 0.5)
      this.stockTexts[commodity.id] = stockText

      const buyOneBtn = this.add
        .text(buyOneX, y, 'Buy', {
          fontFamily: 'monospace',
          fontSize: rowFontSize,
          color: '#44ff88',
          backgroundColor: '#113322',
          padding: buttonPadding,
        })
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const affordable = Math.floor(gameState.credits / gameState.getPrice(commodity.id))
          const qty = Math.min(
            this.getTradeMultiplier(),
            gameState.getStock(commodity.id),
            gameState.cargoFree,
            affordable,
          )
          gameState.buy(commodity.id, qty)
          this.refresh()
        })
      this.buyOneButtons[commodity.id] = buyOneBtn

      const buyAllBtn = this.add
        .text(buyAllX, y, 'All', {
          fontFamily: 'monospace',
          fontSize: rowFontSize,
          color: '#44ff88',
          backgroundColor: '#113322',
          padding: buttonPadding,
        })
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const affordable = Math.floor(gameState.credits / gameState.getPrice(commodity.id))
          const qty = Math.min(affordable, gameState.getStock(commodity.id), gameState.cargoFree)
          gameState.buy(commodity.id, qty)
          this.refresh()
        })
      this.buyAllButtons[commodity.id] = buyAllBtn

      const basisText = this.add
        .text(basisX, y, '', {
          fontFamily: 'monospace',
          fontSize: rowFontSize,
          color: '#888888',
        })
        .setOrigin(0, 0.5)
      this.basisTexts[commodity.id] = basisText

      const inventoryText = this.add
        .text(inventoryX, y, '', {
          fontFamily: 'monospace',
          fontSize: rowFontSize,
          color: '#cccccc',
        })
        .setOrigin(0, 0.5)
      this.inventoryTexts[commodity.id] = inventoryText

      const sellOneBtn = this.add
        .text(sellOneX, y, 'Sell', {
          fontFamily: 'monospace',
          fontSize: rowFontSize,
          color: '#ff8844',
          backgroundColor: '#332211',
          padding: buttonPadding,
        })
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const qty = Math.min(
            this.getTradeMultiplier(),
            gameState.cargo[commodity.id] ?? 0,
            gameState.stockSpace(commodity.id),
          )
          gameState.sell(commodity.id, qty)
          this.refresh()
        })
      this.sellOneButtons[commodity.id] = sellOneBtn

      const sellAllBtn = this.add
        .text(sellAllX, y, 'All', {
          fontFamily: 'monospace',
          fontSize: rowFontSize,
          color: '#ff8844',
          backgroundColor: '#332211',
          padding: buttonPadding,
        })
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const qty = Math.min(gameState.cargo[commodity.id] ?? 0, gameState.stockSpace(commodity.id))
          gameState.sell(commodity.id, qty)
          this.refresh()
        })
      this.sellAllButtons[commodity.id] = sellAllBtn

      buyOneBtn.name = `buy-one-${commodity.id}`
      buyAllBtn.name = `buy-all-${commodity.id}`
      sellOneBtn.name = `sell-one-${commodity.id}`
      sellAllBtn.name = `sell-all-${commodity.id}`
    })

    this.divider1 = this.add.rectangle(divider1X, ROW_START_Y - 9, 3, ROW_HEIGHT, 0x445566).setOrigin(0.5, 0)
    this.divider2 = this.add.rectangle(divider2X, ROW_START_Y - 9, 3, ROW_HEIGHT, 0x445566).setOrigin(0.5, 0)

    // Scrollbar, drawn just inside the right edge of the table.
    const scrollbarX = tableRight - SCROLLBAR_WIDTH - 4
    this.scrollTrack = this.add
      .rectangle(scrollbarX, ROW_START_Y - 9, SCROLLBAR_WIDTH, ROW_HEIGHT, 0x1a2740)
      .setOrigin(0, 0)
    this.scrollThumb = this.add
      .rectangle(scrollbarX, ROW_START_Y - 9, SCROLLBAR_WIDTH, ROW_HEIGHT, 0x4a6a99)
      .setOrigin(0, 0)

    // Mouse wheel scrolls the table one row per notch.
    this.input.on(
      'wheel',
      (_p: unknown, _o: unknown, _dx: number, dy: number) => {
        this.scrollBy(dy > 0 ? 1 : -1)
      },
    )

    this.upgradeButton = this.add
      .text(this.scale.width / 2, this.footerY, '', {
        fontFamily: 'monospace',
        fontSize: '27px',
        color: '#66ccff',
        backgroundColor: '#112233',
        padding: { x: 15, y: 9 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        gameState.upgradeCargo()
        this.refresh()
      })

    this.createFlyout()

    this.refresh()

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this)
    })
  }

  private handleResize() {
    this.scene.restart()
  }

  private getTradeMultiplier(): number {
    if (this.ctrlKey.isDown && this.shiftKey.isDown) return 1000
    if (this.shiftKey.isDown) return 100
    if (this.ctrlKey.isDown) return 10
    return 1
  }

  /** Commodities worth a row here: those in local stock or in the hold. */
  private visibleCommodities() {
    return COMMODITIES.filter((commodity) => {
      const stock = gameState.getStock(commodity.id)
      const held = gameState.cargo[commodity.id] ?? 0
      return !(stock === 0 && held === 0)
    })
  }

  private maxScrollRow(rowCount = this.visibleCommodities().length): number {
    return Math.max(0, rowCount - this.visibleCapacity)
  }

  /** Scroll the table by whole rows and repaint if the position changed. */
  private scrollBy(rows: number) {
    const next = Phaser.Math.Clamp(this.scrollRow + rows, 0, this.maxScrollRow())
    if (next !== this.scrollRow) {
      this.scrollRow = next
      // The hovered row slides out from under the cursor, so drop its flyout.
      this.hideFlyout()
      this.refresh()
    }
  }

  /**
   * Builds the (initially hidden) hover flyout: a bordered panel sized to its
   * text in {@link showCommodityFlyout}. Drawn above every row at a high depth.
   */
  private createFlyout() {
    const bg = this.add.rectangle(0, 0, 10, 10, 0x0a1420, 0.95).setOrigin(0, 0.5)
    bg.setStrokeStyle(1.5, 0x4488ff, 0.9)
    const text = this.add
      .text(FLYOUT_PAD_X, 0, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#cfefff',
      })
      .setOrigin(0, 0.5)
    this.flyoutBg = bg
    this.flyoutText = text
    this.flyout = this.add.container(0, 0, [bg, text]).setDepth(1000).setVisible(false)
  }

  /** Pops the flyout above the commodity's name, noting its producing system. */
  private showCommodityFlyout(commodity: Commodity, nameText: Phaser.GameObjects.Text) {
    const producer = SYSTEMS.find((s) => s.id === commodity.systemId)!
    const producedHere = producer.id === gameState.currentSystemId
    this.flyoutText.setText(
      producedHere ? `Produced here — ${producer.name}` : `Produced in ${producer.name}`,
    )
    const width = this.flyoutText.width + FLYOUT_PAD_X * 2
    const height = this.flyoutText.height + FLYOUT_PAD_Y * 2
    this.flyoutBg.setSize(width, height)
    // Origin-centered flyout, floated just above the hovered name.
    this.flyout.setPosition(nameText.x, nameText.y - 6 - height / 2).setVisible(true)
  }

  private hideFlyout() {
    this.flyout.setVisible(false)
  }

  private refresh() {
    this.hud.setText(
      [
        `Credits: ${gameState.credits.toLocaleString()}`,
        `Cargo: ${gameState.cargoUsed}/${gameState.cargoCapacity}`,
      ].join('  |  '),
    )

    // Keep the top status bar's credits in sync with the ones shown here.
    const topBarCredits = this.children.getByName(CREDITS_NAME) as Phaser.GameObjects.Text | null
    topBarCredits?.setText(`${gameState.credits.toLocaleString()}cr`)

    const visible = this.visibleCommodities()
    this.scrollRow = Phaser.Math.Clamp(this.scrollRow, 0, this.maxScrollRow(visible.length))

    const windowStart = this.scrollRow
    const windowEnd = Math.min(visible.length, windowStart + this.visibleCapacity)
    const windowRowById = new Map<string, number>()
    for (let i = windowStart; i < windowEnd; i++) {
      windowRowById.set(visible[i].id, i - windowStart)
    }
    const multiplier = this.getTradeMultiplier()

    for (const commodity of COMMODITIES) {
      const nameText = this.nameTexts[commodity.id]
      const priceText = this.priceTexts[commodity.id]
      const stockText = this.stockTexts[commodity.id]
      const basisText = this.basisTexts[commodity.id]
      const inventoryText = this.inventoryTexts[commodity.id]
      const buyOneBtn = this.buyOneButtons[commodity.id]
      const buyAllBtn = this.buyAllButtons[commodity.id]
      const sellOneBtn = this.sellOneButtons[commodity.id]
      const sellAllBtn = this.sellAllButtons[commodity.id]
      const rowBg = this.rowBackgrounds[commodity.id]

      const rowObjects = [
        rowBg,
        nameText,
        priceText,
        stockText,
        basisText,
        inventoryText,
        buyOneBtn,
        buyAllBtn,
        sellOneBtn,
        sellAllBtn,
      ]

      const windowRow = windowRowById.get(commodity.id)
      const shown = windowRow !== undefined
      rowObjects.forEach((obj) => obj?.setVisible(shown))
      if (!shown) {
        buyOneBtn?.disableInteractive()
        buyAllBtn?.disableInteractive()
        sellOneBtn?.disableInteractive()
        sellAllBtn?.disableInteractive()
        continue
      }

      const price = gameState.getPrice(commodity.id)
      const held = gameState.cargo[commodity.id] ?? 0
      const stock = gameState.getStock(commodity.id)

      const canBuy = stock > 0 && gameState.cargoFree > 0 && gameState.canAfford(commodity.id, 1)
      const canSell = held > 0 && gameState.stockSpace(commodity.id) > 0
      if (canBuy) {
        buyOneBtn?.setInteractive({ useHandCursor: true }).setAlpha(1)
        buyAllBtn?.setInteractive({ useHandCursor: true }).setAlpha(1)
      } else {
        buyOneBtn?.disableInteractive().setAlpha(0.4)
        buyAllBtn?.disableInteractive().setAlpha(0.4)
      }
      if (canSell) {
        sellOneBtn?.setInteractive({ useHandCursor: true }).setAlpha(1)
        sellAllBtn?.setInteractive({ useHandCursor: true }).setAlpha(1)
      } else {
        sellOneBtn?.disableInteractive().setAlpha(0.4)
        sellAllBtn?.disableInteractive().setAlpha(0.4)
      }

      const rowTop = ROW_START_Y - 9 + windowRow * ROW_HEIGHT
      // Content objects use a vertically-centered origin, so anchor them to the
      // middle of the row band; the background hangs from its top-left corner.
      const rowCenterY = rowTop + ROW_HEIGHT / 2
      rowObjects.forEach((obj) => obj?.setY(rowCenterY))
      rowBg?.setY(rowTop)
      rowBg?.setFillStyle(windowRow % 2 === 0 ? ROW_COLOR_EVEN : ROW_COLOR_ODD)

      const percentOffBase = Math.round(((price - commodity.basePrice) / commodity.basePrice) * 100)
      priceText?.setText(`${price}cr ${formatDelta(percentOffBase)}`)
      priceText?.setColor(percentOffBase > 0 ? '#ff8844' : percentOffBase < 0 ? '#44ff88' : '#cccccc')

      stockText?.setText(`(${stock})`)

      const basisDelta = gameState.getBasisDeltaPercent(commodity.id)
      if (basisDelta === null) {
        basisText?.setText('')
      } else {
        const avgBasis = gameState.getAverageBasis(commodity.id)!
        const roundedDelta = Math.round(basisDelta)
        basisText?.setText(`${Math.round(avgBasis)}cr ${formatDelta(roundedDelta)}`)
        basisText?.setColor(roundedDelta > 0 ? '#44ff88' : roundedDelta < 0 ? '#ff8844' : '#ffffff')
      }

      inventoryText?.setText(`(${held})`)

      buyOneBtn?.setText(multiplier === 1 ? 'Buy' : `x${multiplier}`)
      sellOneBtn?.setText(multiplier === 1 ? 'Sell' : `x${multiplier}`)
    }

    const shownRows = windowEnd - windowStart
    const tableHeight = shownRows * ROW_HEIGHT
    this.divider1.setSize(3, tableHeight)
    this.divider2.setSize(3, tableHeight)

    this.updateScrollbar(visible.length)

    this.upgradeButton.setY(this.footerY)
    this.upgradeButton.setText(
      `Upgrade Cargo Hold (+${20}) — ${gameState.cargoUpgradeCost().toLocaleString()}cr`,
    )
  }

  /** Size and place the scrollbar thumb, or hide the bar when nothing overflows. */
  private updateScrollbar(rowCount: number) {
    const trackTop = ROW_START_Y - 9
    const trackHeight = this.visibleCapacity * ROW_HEIGHT
    const overflow = rowCount > this.visibleCapacity
    this.scrollTrack.setVisible(overflow).setSize(SCROLLBAR_WIDTH, trackHeight).setY(trackTop)
    this.scrollThumb.setVisible(overflow)
    if (!overflow) return

    const thumbHeight = Math.max(30, (trackHeight * this.visibleCapacity) / rowCount)
    const maxScroll = this.maxScrollRow(rowCount)
    const progress = maxScroll > 0 ? this.scrollRow / maxScroll : 0
    this.scrollThumb
      .setSize(SCROLLBAR_WIDTH, thumbHeight)
      .setY(trackTop + progress * (trackHeight - thumbHeight))
  }
}
