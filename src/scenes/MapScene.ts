import Phaser from 'phaser'
import { MAP_HEIGHT, MAP_WIDTH, MAX_JUMP_DIST, SYSTEMS, type StarSystem } from '../data/systems'
import { gameState } from '../game/GameState'

const VIEW_PAD = 90

export class MapScene extends Phaser.Scene {
  private hud!: Phaser.GameObjects.Text

  constructor() {
    super('MapScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#000010')
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT)

    // Zoom is fixed from the graph's max jump distance (not the current system),
    // so every system frames its neighbors the same consistent way.
    const zoom = Math.min(this.scale.width / 2 / (MAX_JUMP_DIST + VIEW_PAD), this.scale.height / 2 / (MAX_JUMP_DIST + VIEW_PAD), 1)
    this.cameras.main.setZoom(zoom)

    const here = SYSTEMS.find((s) => s.id === gameState.currentSystemId)!
    this.cameras.main.centerOn(here.x, here.y)

    const title = this.add
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

    // A dedicated screen-space camera keeps the HUD/title crisp and fixed
    // regardless of the main camera's zoom.
    const uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height)
    this.cameras.main.ignore([title, this.hud])

    const worldObjects = [...this.drawRoutes(zoom), ...this.drawStations(here, zoom)]
    uiCamera.ignore(worldObjects)

    this.refreshHud()
  }

  private drawRoutes(zoom: number): Phaser.GameObjects.GameObject[] {
    const graphics = this.add.graphics()
    const lineWidth = Phaser.Math.Clamp(1.5 / zoom, 1, 6)
    graphics.lineStyle(lineWidth, 0x334455, 0.6)
    const drawn = new Set<string>()
    for (const system of SYSTEMS) {
      for (const targetId of system.connections) {
        const key = [system.id, targetId].sort().join('|')
        if (drawn.has(key)) continue
        drawn.add(key)
        const target = SYSTEMS.find((s) => s.id === targetId)!
        graphics.lineBetween(system.x, system.y, target.x, target.y)
      }
    }
    return [graphics]
  }

  private drawStations(here: StarSystem, zoom: number): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = []
    const markerScale = 1 / zoom

    for (const system of SYSTEMS) {
      const isHere = system.id === here.id
      const isReachable = here.connections.includes(system.id)
      const fillColor = isHere ? 0x44ff88 : isReachable ? 0x4488ff : 0x445566

      const circle = this.add.circle(system.x, system.y, 22, fillColor)
      circle.setStrokeStyle(2, isReachable || isHere ? 0xffffff : 0x667788)
      circle.setScale(markerScale)
      objects.push(circle)

      const nameText = this.add
        .text(system.x, system.y - 40 * markerScale, system.name, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: isReachable || isHere ? '#ffffff' : '#778899',
        })
        .setOrigin(0.5)
        .setScale(markerScale)
      objects.push(nameText)

      const statusLabel = isHere ? 'DOCKED' : isReachable ? 'Travel' : 'Too Far'
      const statusText = this.add
        .text(system.x, system.y + 34 * markerScale, statusLabel, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: isHere ? '#44ff88' : isReachable ? '#aaaaaa' : '#556677',
        })
        .setOrigin(0.5)
        .setScale(markerScale)
      objects.push(statusText)

      if (isHere) {
        circle.setInteractive({ useHandCursor: true })
        circle.on('pointerdown', () => {
          this.scene.start('MarketScene')
        })
      } else if (isReachable) {
        circle.setInteractive({ useHandCursor: true })
        circle.on('pointerdown', () => {
          if (gameState.travelTo(system.id)) {
            this.scene.restart()
          }
        })
      }
    }

    return objects
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
