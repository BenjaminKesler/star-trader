import Phaser from 'phaser'
import { SYSTEMS } from '../data/systems'
import { gameState } from '../game/GameState'

export class MapScene extends Phaser.Scene {
  private hud!: Phaser.GameObjects.Text

  constructor() {
    super('MapScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#000010')

    this.add
      .text(this.scale.width / 2, 30, gameState.companyName, {
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

    this.drawRoutes()
    this.drawStations()
    this.refreshHud()
  }

  private drawRoutes() {
    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0x334455, 0.6)
    for (let i = 0; i < SYSTEMS.length; i++) {
      for (let j = i + 1; j < SYSTEMS.length; j++) {
        graphics.lineBetween(SYSTEMS[i].x, SYSTEMS[i].y, SYSTEMS[j].x, SYSTEMS[j].y)
      }
    }
  }

  private drawStations() {
    for (const system of SYSTEMS) {
      const isHere = system.id === gameState.currentSystemId
      const circle = this.add.circle(system.x, system.y, 22, isHere ? 0x44ff88 : 0x4488ff)
      circle.setStrokeStyle(2, 0xffffff)
      circle.setInteractive({ useHandCursor: true })

      this.add
        .text(system.x, system.y - 40, system.name, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ffffff',
        })
        .setOrigin(0.5)

      this.add
        .text(system.x, system.y + 34, isHere ? 'DOCKED' : 'Travel', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: isHere ? '#44ff88' : '#aaaaaa',
        })
        .setOrigin(0.5)

      circle.on('pointerdown', () => {
        if (isHere) {
          this.scene.start('MarketScene')
        } else {
          gameState.travelTo(system.id)
          this.scene.restart()
        }
      })
    }
  }

  private refreshHud() {
    const here = SYSTEMS.find((s) => s.id === gameState.currentSystemId)!
    this.hud.setText(
      [
        `Ship: ${gameState.shipName}`,
        `Location: ${here.name}`,
        `Credits: ${gameState.credits.toLocaleString()}`,
        `Cargo: ${gameState.cargoUsed}/${gameState.cargoCapacity}`,
        `Net worth: ${Math.round(gameState.netWorth).toLocaleString()}`,
      ].join('\n'),
    )
  }
}
