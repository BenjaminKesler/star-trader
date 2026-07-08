import Phaser from 'phaser'
import { gameState } from '../game/GameState'
import { SUBSYSTEMS, SUBSYSTEM_MAX, type SubsystemId } from '../data/subsystems'
import { createTabBar, CREDITS_NAME } from '../ui/TabBar'
import { FONT_DISPLAY, FONT_MONO } from '../ui/fonts'

const ROW_HEIGHT = 96
const ROWS_START_Y = 200
/** Widest a Depot row grows to; on wider windows the column is centered. */
const PANEL_MAX_WIDTH = 1000
const PANEL_MARGIN = 30

const ROW_COLOR = 0x0c1424

/** Integrity colour bands: healthy, worn, critical. */
function integrityColor(fraction: number): string {
  if (fraction <= 0.25) return '#ff5544'
  if (fraction <= 0.6) return '#ffcc44'
  return '#44ff88'
}

/**
 * Depot page. Services the ship: a flat-rate refuel, plus per-subsystem repairs
 * (priced per point of integrity restored) and a Repair All convenience. Every
 * spend is booked to the Budget page's cost lines.
 */
export class DepotScene extends Phaser.Scene {
  private hud!: Phaser.GameObjects.Text
  private fuelText!: Phaser.GameObjects.Text
  private refuelButton!: Phaser.GameObjects.Text
  private integrityTexts: Partial<Record<SubsystemId, Phaser.GameObjects.Text>> = {}
  private repairButtons: Partial<Record<SubsystemId, Phaser.GameObjects.Text>> = {}
  private repairAllButton!: Phaser.GameObjects.Text

  constructor() {
    super('DepotScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#000010')
    this.integrityTexts = {}
    this.repairButtons = {}

    createTabBar(this, this.scene.key)

    const centerX = this.scale.width / 2

    this.add
      .text(centerX, 75, 'Depot', {
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

    // --- Fuel row ---
    const fuelTop = ROWS_START_Y
    const fuelCenterY = fuelTop + ROW_HEIGHT / 2
    this.add
      .rectangle(panelLeft, fuelTop, panelWidth, ROW_HEIGHT - 12, ROW_COLOR)
      .setOrigin(0, 0)
      .setStrokeStyle(1.5, 0x223850)
    this.add
      .text(panelLeft + 28, fuelCenterY - 16, 'Fuel', {
        fontFamily: FONT_MONO,
        fontStyle: 'bold',
        fontSize: '26px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5)
    this.fuelText = this.add
      .text(panelLeft + 28, fuelCenterY + 16, '', {
        fontFamily: FONT_MONO,
        fontSize: '20px',
        color: '#8fa6c0',
      })
      .setOrigin(0, 0.5)
    this.refuelButton = this.add
      .text(panelRight - 28, fuelCenterY, '', {
        fontFamily: FONT_MONO,
        fontSize: '22px',
        color: '#66ccff',
        backgroundColor: '#112233',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(1, 0.5)
      .on('pointerdown', () => {
        gameState.refuel()
        this.refresh()
      })

    // --- Subsystem repair rows ---
    SUBSYSTEMS.forEach((subsystem, i) => {
      const rowTop = ROWS_START_Y + (i + 1) * ROW_HEIGHT
      const rowCenterY = rowTop + ROW_HEIGHT / 2

      this.add
        .rectangle(panelLeft, rowTop, panelWidth, ROW_HEIGHT - 12, ROW_COLOR)
        .setOrigin(0, 0)
        .setStrokeStyle(1.5, 0x223850)

      this.add
        .text(panelLeft + 28, rowCenterY - 16, subsystem.name, {
          fontFamily: FONT_MONO,
          fontStyle: 'bold',
          fontSize: '26px',
          color: '#ffffff',
        })
        .setOrigin(0, 0.5)

      this.add
        .text(panelLeft + 28, rowCenterY + 16, subsystem.description, {
          fontFamily: FONT_MONO,
          fontSize: '20px',
          color: '#8fa6c0',
        })
        .setOrigin(0, 0.5)

      const repairBtn = this.add
        .text(panelRight - 28, rowCenterY, '', {
          fontFamily: FONT_MONO,
          fontSize: '22px',
          color: '#44ff88',
          backgroundColor: '#113322',
          padding: { x: 14, y: 8 },
        })
        .setOrigin(1, 0.5)
        .on('pointerdown', () => {
          gameState.repair(subsystem.id)
          this.refresh()
        })
      this.repairButtons[subsystem.id] = repairBtn

      // Integrity readout sits to the left of the repair button, on the name line.
      this.integrityTexts[subsystem.id] = this.add
        .text(panelRight - 28 - 260, rowCenterY, '', {
          fontFamily: FONT_MONO,
          fontStyle: 'bold',
          fontSize: '24px',
          color: '#cccccc',
        })
        .setOrigin(1, 0.5)
    })

    // --- Repair All ---
    const allTop = ROWS_START_Y + (SUBSYSTEMS.length + 1) * ROW_HEIGHT + 6
    this.repairAllButton = this.add
      .text(panelRight - 28, allTop, '', {
        fontFamily: FONT_MONO,
        fontSize: '22px',
        color: '#ffdd88',
        backgroundColor: '#33280f',
        padding: { x: 16, y: 9 },
      })
      .setOrigin(1, 0)
      .on('pointerdown', () => {
        gameState.repairAll()
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

  private setEnabled(button: Phaser.GameObjects.Text, enabled: boolean) {
    if (enabled) button.setInteractive({ useHandCursor: true }).setAlpha(1)
    else button.disableInteractive().setAlpha(0.4)
  }

  private refresh() {
    this.hud.setText(`Credits: ${gameState.credits.toLocaleString()}`)

    // Keep the top status bar's credits in sync after servicing the ship.
    const topBarCredits = this.children.getByName(CREDITS_NAME) as Phaser.GameObjects.Text | null
    topBarCredits?.setText(`${gameState.credits.toLocaleString()}cr`)

    this.fuelText.setText(`${gameState.fuel.toLocaleString()} / ${gameState.maxFuel.toLocaleString()}`)
    this.refuelButton.setText(`Refuel — ${gameState.refuelCost().toLocaleString()}cr`)
    this.setEnabled(
      this.refuelButton,
      gameState.fuel < gameState.maxFuel && gameState.credits >= gameState.refuelCost(),
    )

    for (const subsystem of SUBSYSTEMS) {
      const integrity = gameState.subsystems[subsystem.id]
      const percent = Math.round((integrity / SUBSYSTEM_MAX) * 100)
      this.integrityTexts[subsystem.id]
        ?.setText(`${percent}%`)
        .setColor(integrityColor(integrity / SUBSYSTEM_MAX))

      const button = this.repairButtons[subsystem.id]
      if (!button) continue
      const cost = gameState.repairCost(subsystem.id)
      button.setText(percent >= 100 ? 'Repaired' : `Repair — ${cost.toLocaleString()}cr`)
      this.setEnabled(button, gameState.canRepair(subsystem.id))
    }

    const allCost = gameState.repairAllCost()
    this.repairAllButton.setText(
      allCost <= 0 ? 'All Systems Nominal' : `Repair All — ${allCost.toLocaleString()}cr`,
    )
    this.setEnabled(this.repairAllButton, gameState.canRepairAll())
  }
}
