import Phaser from 'phaser'
import { gameState } from '../game/GameState'
import { EXPANSIONS, type ExpansionId } from '../data/expansions'
import { createTabBar, CREDITS_NAME } from '../ui/TabBar'
import { FONT_DISPLAY, FONT_MONO } from '../ui/fonts'

const ROW_HEIGHT = 110
const ROWS_START_Y = 210
/** Widest a store row grows to; on wider windows the column is centered. */
const PANEL_MAX_WIDTH = 1000
const PANEL_MARGIN = 30

const ROW_COLOR = 0x0c1424

/**
 * Outfitter store. Sells ship expansions, each of which occupies one of the
 * ship's expansion bays. Installing costs full price and is gated on both a free
 * bay and enough credits; selling one back refunds half its price and frees its
 * bay. Effects (fuel, cargo, engine speed) live in {@link gameState}.
 */
export class OutfitterScene extends Phaser.Scene {
  private hud!: Phaser.GameObjects.Text
  private installedTexts: Partial<Record<ExpansionId, Phaser.GameObjects.Text>> = {}
  private installButtons: Partial<Record<ExpansionId, Phaser.GameObjects.Text>> = {}
  private sellButtons: Partial<Record<ExpansionId, Phaser.GameObjects.Text>> = {}

  constructor() {
    super('OutfitterScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#000010')
    this.installedTexts = {}
    this.installButtons = {}
    this.sellButtons = {}

    createTabBar(this, this.scene.key)

    const centerX = this.scale.width / 2

    this.add
      .text(centerX, 75, 'Outfitter', {
        fontFamily: FONT_DISPLAY,
        fontStyle: 'bold',
        fontSize: '36px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0)

    this.hud = this.add
      .text(centerX, 140, '', {
        fontFamily: FONT_MONO,
        fontSize: '24px',
        color: '#9adfff',
      })
      .setOrigin(0.5, 0)

    const panelWidth = Math.min(PANEL_MAX_WIDTH, this.scale.width - PANEL_MARGIN * 2)
    const panelLeft = centerX - panelWidth / 2
    const panelRight = centerX + panelWidth / 2

    EXPANSIONS.forEach((expansion, i) => {
      const rowTop = ROWS_START_Y + i * ROW_HEIGHT
      const rowCenterY = rowTop + ROW_HEIGHT / 2

      this.add
        .rectangle(panelLeft, rowTop, panelWidth, ROW_HEIGHT - 12, ROW_COLOR)
        .setOrigin(0, 0)
        .setStrokeStyle(1.5, 0x223850)

      this.add
        .text(panelLeft + 28, rowCenterY - 16, expansion.name, {
          fontFamily: FONT_MONO,
          fontStyle: 'bold',
          fontSize: '26px',
          color: '#ffffff',
        })
        .setOrigin(0, 0.5)

      this.add
        .text(panelLeft + 28, rowCenterY + 16, expansion.description, {
          fontFamily: FONT_MONO,
          fontSize: '20px',
          color: '#8fa6c0',
        })
        .setOrigin(0, 0.5)

      // Right cluster: Sell button pinned to the right edge, Install to its left.
      // Its label carries the (fixed) refund so its width is settled up front,
      // letting the Install button anchor cleanly to its left edge.
      const sellBtn = this.add
        .text(panelRight - 28, rowCenterY, `Sell — +${gameState.expansionRefund(expansion.id).toLocaleString()}cr`, {
          fontFamily: FONT_MONO,
          fontSize: '22px',
          color: '#ff8844',
          backgroundColor: '#332211',
          padding: { x: 14, y: 8 },
        })
        .setOrigin(1, 0.5)
        .on('pointerdown', () => {
          gameState.removeExpansion(expansion.id)
          this.refresh()
        })
      this.sellButtons[expansion.id] = sellBtn

      const installBtn = this.add
        .text(sellBtn.x - sellBtn.width - 16, rowCenterY, `Install — ${expansion.price.toLocaleString()}cr`, {
          fontFamily: FONT_MONO,
          fontSize: '22px',
          color: '#44ff88',
          backgroundColor: '#113322',
          padding: { x: 14, y: 8 },
        })
        .setOrigin(1, 0.5)
        .on('pointerdown', () => {
          gameState.installExpansion(expansion.id)
          this.refresh()
        })
      this.installButtons[expansion.id] = installBtn

      // Installed count sits to the left of the button cluster, lifted to the
      // name row so it clears the (longer) description line beneath it.
      this.installedTexts[expansion.id] = this.add
        .text(installBtn.x - installBtn.width - 36, rowCenterY - 16, '', {
          fontFamily: FONT_MONO,
          fontSize: '22px',
          color: '#cccccc',
        })
        .setOrigin(1, 0.5)
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

  private refresh() {
    this.hud.setText(
      [
        `Credits: ${gameState.credits.toLocaleString()}`,
        `Bays: ${gameState.usedBays} / ${gameState.expansionBays}`,
      ].join('  |  '),
    )

    // Keep the top status bar's credits in sync after installing or selling.
    const topBarCredits = this.children.getByName(CREDITS_NAME) as Phaser.GameObjects.Text | null
    topBarCredits?.setText(`${gameState.credits.toLocaleString()}cr`)

    for (const expansion of EXPANSIONS) {
      const installed = gameState.installedExpansions[expansion.id]
      this.installedTexts[expansion.id]?.setText(`Installed: ${installed}`)

      const installBtn = this.installButtons[expansion.id]
      if (gameState.canInstallExpansion(expansion.id)) {
        installBtn?.setInteractive({ useHandCursor: true }).setAlpha(1)
      } else {
        installBtn?.disableInteractive().setAlpha(0.4)
      }

      const sellBtn = this.sellButtons[expansion.id]
      sellBtn?.setText(`Sell — +${gameState.expansionRefund(expansion.id).toLocaleString()}cr`)
      if (gameState.canRemoveExpansion(expansion.id)) {
        sellBtn?.setInteractive({ useHandCursor: true }).setAlpha(1)
      } else {
        sellBtn?.disableInteractive().setAlpha(0.4)
      }
    }
  }
}
