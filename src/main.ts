import Phaser from 'phaser'
import './style.css'
import { BootScene } from './scenes/BootScene'
import { MapScene } from './scenes/MapScene'
import { MarketScene } from './scenes/MarketScene'
import { FinancesScene } from './scenes/FinancesScene'
import { BudgetScene } from './scenes/BudgetScene'
import { DepotScene } from './scenes/DepotScene'
import { OutfitterScene } from './scenes/OutfitterScene'
import { ContractsScene, ShipyardScene } from './scenes/PlaceholderScenes'

new Phaser.Game({
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'app',
  backgroundColor: '#000010',
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  scene: [BootScene, MapScene, MarketScene, FinancesScene, BudgetScene, ContractsScene, ShipyardScene, OutfitterScene, DepotScene],
})
