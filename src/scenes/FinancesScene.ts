import Phaser from 'phaser'
import { createTabBar, TAB_BAR_HEIGHT } from '../ui/TabBar'
import { gameState } from '../game/GameState'

/**
 * The Finances page. For now it just reports current net worth; more
 * financial detail (income, expenses, rank progress) will land here later.
 */
export class FinancesScene extends Phaser.Scene {
  constructor() {
    super('FinancesScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#000010')
    createTabBar(this, this.scene.key)

    const netWorth = Math.round(gameState.netWorth).toLocaleString()
    this.add
      .text(40, TAB_BAR_HEIGHT + 30, `Net worth: ${netWorth}cr`, {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0, 0)

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this)
    })
  }

  private handleResize() {
    this.scene.restart()
  }
}
