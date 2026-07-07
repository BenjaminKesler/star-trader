import Phaser from 'phaser'
import './style.css'
import { BootScene } from './scenes/BootScene'
import { MapScene } from './scenes/MapScene'
import { MarketScene } from './scenes/MarketScene'
import { FinancesScene } from './scenes/FinancesScene'
import { FuelDepotScene } from './scenes/FuelDepotScene'
import { ContractsScene, ShipyardScene, OutfitterScene } from './scenes/PlaceholderScenes'

new Phaser.Game({
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'app',
  backgroundColor: '#000010',
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  scene: [BootScene, MapScene, MarketScene, FinancesScene, ContractsScene, ShipyardScene, OutfitterScene, FuelDepotScene],
})
