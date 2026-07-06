import Phaser from 'phaser'
import { createTabBar, TOP_BAR_HEIGHT, BOTTOM_BAR_HEIGHT } from '../ui/TabBar'

/**
 * A stub scene that shows only the tab bar and its own title, centered.
 * These stand in for pages whose logic hasn't been built yet.
 */
abstract class PlaceholderScene extends Phaser.Scene {
  private readonly title: string

  constructor(key: string, title: string) {
    super(key)
    this.title = title
  }

  create() {
    this.cameras.main.setBackgroundColor('#000010')
    createTabBar(this, this.scene.key)

    this.add
      .text(this.scale.width / 2, (TOP_BAR_HEIGHT + this.scale.height - BOTTOM_BAR_HEIGHT) / 2, this.title, {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this)
    })
  }

  private handleResize() {
    this.scene.restart()
  }
}

export class ContractsScene extends PlaceholderScene {
  constructor() {
    super('ContractsScene', 'Contracts')
  }
}

export class ShipyardScene extends PlaceholderScene {
  constructor() {
    super('ShipyardScene', 'Shipyard')
  }
}

export class OutfitterScene extends PlaceholderScene {
  constructor() {
    super('OutfitterScene', 'Outfitter')
  }
}

export class FuelDepotScene extends PlaceholderScene {
  constructor() {
    super('FuelDepotScene', 'Fuel Depot')
  }
}
