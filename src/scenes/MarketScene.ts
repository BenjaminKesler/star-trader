import Phaser from 'phaser'
import { COMMODITIES } from '../data/commodities'
import { SYSTEMS } from '../data/systems'
import { gameState } from '../game/GameState'

const TRADE_QTY = 10
const ROW_HEIGHT = 48
const ROW_START_Y = 160

export class MarketScene extends Phaser.Scene {
  private hud!: Phaser.GameObjects.Text
  private priceTexts: Partial<Record<string, Phaser.GameObjects.Text>> = {}
  private percentTexts: Partial<Record<string, Phaser.GameObjects.Text>> = {}
  private detailTexts: Partial<Record<string, Phaser.GameObjects.Text>> = {}
  private upgradeButton!: Phaser.GameObjects.Text

  constructor() {
    super('MarketScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#000010')
    this.priceTexts = {}
    this.percentTexts = {}
    this.detailTexts = {}

    const here = SYSTEMS.find((s) => s.id === gameState.currentSystemId)!

    this.add
      .text(this.scale.width / 2, 30, `${here.name} Market`, {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0)

    this.hud = this.add.text(20, 20, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#9adfff',
    })

    this.add
      .text(this.scale.width - 20, 20, '< Back to Map', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffcc66',
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MapScene'))

    COMMODITIES.forEach((commodity, i) => {
      const y = ROW_START_Y + i * ROW_HEIGHT

      this.add.text(60, y, commodity.name, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
      })

      const priceText = this.add.text(260, y, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#cccccc',
      })
      this.priceTexts[commodity.id] = priceText

      const percentText = this.add.text(330, y, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#cccccc',
      })
      this.percentTexts[commodity.id] = percentText

      const detailText = this.add.text(400, y, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#cccccc',
      })
      this.detailTexts[commodity.id] = detailText

      const buyBtn = this.add
        .text(740, y, `Buy ${TRADE_QTY}`, {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#44ff88',
          backgroundColor: '#113322',
          padding: { x: 8, y: 4 },
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const qty = Math.min(TRADE_QTY, gameState.getStock(commodity.id), gameState.cargoFree)
          gameState.buy(commodity.id, qty)
          this.refresh()
        })

      const sellBtn = this.add
        .text(890, y, `Sell ${TRADE_QTY}`, {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#ff8844',
          backgroundColor: '#332211',
          padding: { x: 8, y: 4 },
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          gameState.sell(commodity.id, TRADE_QTY)
          this.refresh()
        })

      buyBtn.name = `buy-${commodity.id}`
      sellBtn.name = `sell-${commodity.id}`
    })

    this.upgradeButton = this.add
      .text(this.scale.width / 2, ROW_START_Y + COMMODITIES.length * ROW_HEIGHT + 40, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#66ccff',
        backgroundColor: '#112233',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        gameState.upgradeCargo()
        this.refresh()
      })

    this.refresh()
  }

  private refresh() {
    this.hud.setText(
      [
        `Credits: ${gameState.credits.toLocaleString()}`,
        `Cargo: ${gameState.cargoUsed}/${gameState.cargoCapacity}`,
      ].join('  |  '),
    )

    for (const commodity of COMMODITIES) {
      const price = gameState.getPrice(commodity.id)
      const held = gameState.cargo[commodity.id]
      const stock = gameState.getStock(commodity.id)
      const percentOffBase = Math.round(((price - commodity.basePrice) / commodity.basePrice) * 100)
      const sign = percentOffBase >= 0 ? '+' : ''

      this.priceTexts[commodity.id]?.setText(`${price}cr`)
      const percentText = this.percentTexts[commodity.id]
      percentText?.setText(`${sign}${percentOffBase}%`)
      percentText?.setColor(percentOffBase > 0 ? '#ff8844' : percentOffBase < 0 ? '#44ff88' : '#cccccc')
      this.detailTexts[commodity.id]?.setText(`(stock ${stock}, holding ${held})`)
    }

    this.upgradeButton.setText(
      `Upgrade Cargo Hold (+${20}) — ${gameState.cargoUpgradeCost().toLocaleString()}cr`,
    )
  }
}
