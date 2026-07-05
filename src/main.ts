import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { MapScene } from './scenes/MapScene'
import { MarketScene } from './scenes/MarketScene'

new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 800,
  parent: 'app',
  backgroundColor: '#000010',
  scene: [BootScene, MapScene, MarketScene],
})
