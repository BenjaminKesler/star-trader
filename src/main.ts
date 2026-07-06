import Phaser from 'phaser'
import './style.css'
import { BootScene } from './scenes/BootScene'
import { MapScene } from './scenes/MapScene'
import { MarketScene } from './scenes/MarketScene'

new Phaser.Game({
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'app',
  backgroundColor: '#000010',
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  scene: [BootScene, MapScene, MarketScene],
})
