import Phaser from 'phaser'
import { gameState } from '../game/GameState'

export interface TabDef {
  label: string
  scene: string
}

/** The always-visible top navigation. Each entry maps a label to a scene key. */
export const TABS: TabDef[] = [
  { label: 'Map', scene: 'MapScene' },
  { label: 'Market', scene: 'MarketScene' },
  { label: 'Contracts', scene: 'ContractsScene' },
  { label: 'Shipyard', scene: 'ShipyardScene' },
  { label: 'Outfitter', scene: 'OutfitterScene' },
  { label: 'Fuel Depot', scene: 'FuelDepotScene' },
]

/** Height of the tab strip in screen pixels. Content should start below this. */
export const TAB_BAR_HEIGHT = 50

/**
 * Adds the top tab bar to a scene and returns every object created, so callers
 * with a separate world camera (e.g. MapScene) can add them to its ignore list.
 * The active tab is highlighted and non-interactive; the rest switch scenes.
 */
export function createTabBar(scene: Phaser.Scene, activeScene: string): Phaser.GameObjects.GameObject[] {
  const objects: Phaser.GameObjects.GameObject[] = []

  const bg = scene.add.rectangle(0, 0, scene.scale.width, TAB_BAR_HEIGHT, 0x0a1020).setOrigin(0, 0)
  const border = scene.add.rectangle(0, TAB_BAR_HEIGHT, scene.scale.width, 2, 0x223344).setOrigin(0, 0)
  objects.push(bg, border)

  let x = 20
  for (const tab of TABS) {
    const isActive = tab.scene === activeScene
    const btn = scene.add
      .text(x, TAB_BAR_HEIGHT / 2, tab.label, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: isActive ? '#ffffff' : '#7a8ba0',
        backgroundColor: isActive ? '#1c2c44' : undefined,
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0, 0.5)

    if (!isActive) {
      btn
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => btn.setColor('#ffffff'))
        .on('pointerout', () => btn.setColor('#7a8ba0'))
        .on('pointerdown', () => scene.scene.start(tab.scene))
    }

    objects.push(btn)
    x += btn.width + 8
  }

  const companyName = scene.add
    .text(scene.scale.width - 20, TAB_BAR_HEIGHT / 2, gameState.companyName, {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#ffffff',
    })
    .setOrigin(1, 0.5)
  objects.push(companyName)

  return objects
}
