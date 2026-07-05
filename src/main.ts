import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'

new Phaser.Game({
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  parent: 'app',
  backgroundColor: '#000010',
  scene: [BootScene],
})
