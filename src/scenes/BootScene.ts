import Phaser from 'phaser'
import { FONT_DISPLAY } from '../ui/fonts'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  create() {
    const title = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Star Trader', {
        fontFamily: FONT_DISPLAY,
        fontStyle: 'bold',
        fontSize: '72px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    // Phaser renders text to a canvas, so the web fonts must be fully loaded
    // before any scene draws — otherwise text falls back to a system font and,
    // worse, widths measured from text (e.g. the Market name column) come out
    // wrong. Wait for both faces here, re-render the splash once they arrive,
    // and never advance to the game until they're ready.
    const fontsReady = Promise.all([
      document.fonts.load('700 72px "Chakra Petch"'),
      document.fonts.load('400 24px "JetBrains Mono"'),
      document.fonts.load('700 24px "JetBrains Mono"'),
    ]).then(() => document.fonts.ready)

    fontsReady.then(() => title.setFontFamily(FONT_DISPLAY))

    // Hold the splash briefly for effect, but gate the start on the fonts.
    const minimumSplash = new Promise((resolve) => this.time.delayedCall(800, resolve))
    Promise.all([fontsReady, minimumSplash]).then(() => this.scene.start('MapScene'))
  }
}
