import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  create() {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Star Trader', {
        fontFamily: 'monospace',
        fontSize: '72px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    this.time.delayedCall(800, () => this.scene.start('MapScene'))
  }
}
