import Phaser from 'phaser'
import { gameState } from '../game/GameState'
import { createTabBar, TOP_BAR_HEIGHT, BOTTOM_BAR_HEIGHT } from '../ui/TabBar'

/**
 * Fuel Depot page. For now this offers a single flat-rate refuel: pay a small
 * fixed fee to top the tank back up to max, regardless of how empty it is.
 */
export class FuelDepotScene extends Phaser.Scene {
  private fuelText!: Phaser.GameObjects.Text
  private refuelButton!: Phaser.GameObjects.Text

  constructor() {
    super('FuelDepotScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#000010')
    createTabBar(this, this.scene.key)

    const centerX = this.scale.width / 2
    const centerY = (TOP_BAR_HEIGHT + this.scale.height - BOTTOM_BAR_HEIGHT) / 2

    this.add
      .text(centerX, 75, 'Fuel Depot', {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0)

    this.fuelText = this.add
      .text(centerX, centerY - 60, '', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#9adfff',
      })
      .setOrigin(0.5)

    this.refuelButton = this.add
      .text(centerX, centerY + 20, '', {
        fontFamily: 'monospace',
        fontSize: '27px',
        color: '#66ccff',
        backgroundColor: '#112233',
        padding: { x: 15, y: 9 },
      })
      .setOrigin(0.5)
      .on('pointerdown', () => {
        gameState.refuel()
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

  private refresh() {
    this.fuelText.setText(`Fuel: ${gameState.fuel} / ${gameState.maxFuel}`)

    this.refuelButton.setText(`Refuel — ${gameState.refuelCost().toLocaleString()}cr`)

    const canRefuel = gameState.fuel < gameState.maxFuel && gameState.credits >= gameState.refuelCost()
    if (canRefuel) {
      this.refuelButton.setInteractive({ useHandCursor: true }).setAlpha(1)
    } else {
      this.refuelButton.disableInteractive().setAlpha(0.4)
    }
  }
}
