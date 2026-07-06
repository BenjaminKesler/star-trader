import Phaser from 'phaser'
import { COMMODITIES } from '../data/commodities'
import { SYSTEMS } from '../data/systems'
import { gameState } from '../game/GameState'

const ROW_HEIGHT = 60
const ROW_START_Y = 240

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

const ROW_COLOR_EVEN = 0x0c1424
const ROW_COLOR_ODD = 0x121d33

const UP_ARROW = '▲'
const DOWN_ARROW = '▼'
const EM_DASH = '—'

function formatDelta(percent: number): string {
  if (percent === 0) return EM_DASH
  const arrow = percent > 0 ? UP_ARROW : DOWN_ARROW
  return `${arrow}${Math.abs(percent)}%`
}

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
  private ctrlKey!: Phaser.Input.Keyboard.Key
  private shiftKey!: Phaser.Input.Keyboard.Key

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

    this.add
      .text(this.scale.width / 2, 45, `${here.name} Market`, {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0)

    this.hud = this.add.text(30, 30, '', {
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

    this.add
      .text(this.scale.width - 30, 30, '< Back to Map', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffcc66',
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MapScene'))

    const availableWidth = this.scale.width - TABLE_MARGIN * 2
    const tableWidth = Math.min(DESIGN_TABLE_WIDTH, availableWidth)
    const columnScale = tableWidth / DESIGN_TABLE_WIDTH
    const tableLeft = (this.scale.width - tableWidth) / 2
    const tableRight = tableLeft + tableWidth

    const nameX = tableLeft + NAME_OFFSET * columnScale
    const divider1X = tableLeft + DIVIDER1_OFFSET * columnScale
    const priceX = tableLeft + PRICE_OFFSET * columnScale
    const stockX = tableLeft + STOCK_OFFSET * columnScale
    const buyOneX = tableLeft + BUY_ONE_OFFSET * columnScale
    const buyAllX = tableLeft + BUY_ALL_OFFSET * columnScale
    const divider2X = tableLeft + DIVIDER2_OFFSET * columnScale
    const basisX = tableLeft + BASIS_OFFSET * columnScale
    const inventoryX = tableLeft + INVENTORY_OFFSET * columnScale
    const sellOneX = tableLeft + SELL_ONE_OFFSET * columnScale
    const sellAllX = tableLeft + SELL_ALL_OFFSET * columnScale

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
      this.nameTexts[commodity.id] = nameText

      const priceText = this.add.text(priceX, y, '', {
        fontFamily: 'monospace',
        fontSize: rowFontSize,
        color: '#cccccc',
      })
      this.priceTexts[commodity.id] = priceText

      const stockText = this.add.text(stockX, y, '', {
        fontFamily: 'monospace',
        fontSize: rowFontSize,
        color: '#cccccc',
      })
      this.stockTexts[commodity.id] = stockText

      const buyOneBtn = this.add
        .text(buyOneX, y, 'Buy', {
          fontFamily: 'monospace',
          fontSize: rowFontSize,
          color: '#44ff88',
          backgroundColor: '#113322',
          padding: buttonPadding,
        })
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
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const affordable = Math.floor(gameState.credits / gameState.getPrice(commodity.id))
          const qty = Math.min(affordable, gameState.getStock(commodity.id), gameState.cargoFree)
          gameState.buy(commodity.id, qty)
          this.refresh()
        })
      this.buyAllButtons[commodity.id] = buyAllBtn

      const basisText = this.add.text(basisX, y, '', {
        fontFamily: 'monospace',
        fontSize: rowFontSize,
        color: '#888888',
      })
      this.basisTexts[commodity.id] = basisText

      const inventoryText = this.add.text(inventoryX, y, '', {
        fontFamily: 'monospace',
        fontSize: rowFontSize,
        color: '#cccccc',
      })
      this.inventoryTexts[commodity.id] = inventoryText

      const sellOneBtn = this.add
        .text(sellOneX, y, 'Sell', {
          fontFamily: 'monospace',
          fontSize: rowFontSize,
          color: '#ff8844',
          backgroundColor: '#332211',
          padding: buttonPadding,
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const qty = Math.min(this.getTradeMultiplier(), gameState.cargo[commodity.id] ?? 0)
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
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const qty = gameState.cargo[commodity.id] ?? 0
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

    this.upgradeButton = this.add
      .text(this.scale.width / 2, ROW_START_Y + COMMODITIES.length * ROW_HEIGHT + 60, '', {
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

  private refresh() {
    this.hud.setText(
      [
        `Credits: ${gameState.credits.toLocaleString()}`,
        `Cargo: ${gameState.cargoUsed}/${gameState.cargoCapacity}`,
      ].join('  |  '),
    )

    let visibleRow = 0

    for (const commodity of COMMODITIES) {
      const price = gameState.getPrice(commodity.id)
      const held = gameState.cargo[commodity.id] ?? 0
      const stock = gameState.getStock(commodity.id)
      const hidden = stock === 0 && held === 0

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
      rowObjects.forEach((obj) => obj?.setVisible(!hidden))
      if (hidden) {
        buyOneBtn?.disableInteractive()
        buyAllBtn?.disableInteractive()
        sellOneBtn?.disableInteractive()
        sellAllBtn?.disableInteractive()
        continue
      }

      const canBuy = stock > 0 && gameState.cargoFree > 0 && gameState.canAfford(commodity.id, 1)
      const canSell = held > 0
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

      const y = ROW_START_Y + visibleRow * ROW_HEIGHT
      rowObjects.forEach((obj) => obj?.setY(y))
      rowBg?.setY(y - 9)
      rowBg?.setFillStyle(visibleRow % 2 === 0 ? ROW_COLOR_EVEN : ROW_COLOR_ODD)
      visibleRow++

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

      const multiplier = this.getTradeMultiplier()
      buyOneBtn?.setText(multiplier === 1 ? 'Buy' : `x${multiplier}`)
      sellOneBtn?.setText(multiplier === 1 ? 'Sell' : `x${multiplier}`)
    }

    const tableHeight = visibleRow * ROW_HEIGHT
    this.divider1.setSize(3, tableHeight)
    this.divider2.setSize(3, tableHeight)

    this.upgradeButton.setY(ROW_START_Y + visibleRow * ROW_HEIGHT + 60)
    this.upgradeButton.setText(
      `Upgrade Cargo Hold (+${20}) — ${gameState.cargoUpgradeCost().toLocaleString()}cr`,
    )
  }
}
