import Phaser from 'phaser'
import { gameState } from '../game/GameState'

export interface TabDef {
  label: string
  scene: string
}

/** The tabs shown in the bottom bar. Each entry maps a label to a scene key. */
export const TABS: TabDef[] = [
  { label: 'Map', scene: 'MapScene' },
  { label: 'Market', scene: 'MarketScene' },
  { label: 'Contracts', scene: 'ContractsScene' },
  { label: 'Finances', scene: 'FinancesScene' },
  { label: 'Shipyard', scene: 'ShipyardScene' },
  { label: 'Outfitter', scene: 'OutfitterScene' },
  { label: 'Fuel Depot', scene: 'FuelDepotScene' },
]

/** Object name of the top-bar galaxy-date text, so scenes can find and update it live. */
export const GALAXY_DATE_NAME = 'galaxyDate'

/** Object name of the top-bar credits text, so scenes can find and update it live (e.g. after a trade). */
export const CREDITS_NAME = 'topBarCredits'

/** Height of the top status bar. Content should start below this. */
export const TOP_BAR_HEIGHT = 50
/** Height of the bottom tab bar. Content should end above this. */
export const BOTTOM_BAR_HEIGHT = 50
/** @deprecated Alias for {@link TOP_BAR_HEIGHT}; content still offsets from the top bar. */
export const TAB_BAR_HEIGHT = TOP_BAR_HEIGHT

/**
 * Adds the persistent chrome (top status bar + bottom tab bar) to a scene and
 * returns every object created, so callers with a separate world camera (e.g.
 * MapScene) can add them to its ignore list. The top bar shows the galaxy date
 * and company; the bottom bar holds the tabs, with the active one highlighted
 * and non-interactive and the rest switching scenes.
 */
export function createTabBar(scene: Phaser.Scene, activeScene: string): Phaser.GameObjects.GameObject[] {
  const objects: Phaser.GameObjects.GameObject[] = []
  const width = scene.scale.width
  const height = scene.scale.height

  // --- Top status bar: four equally-spaced segments ---
  const topBg = scene.add.rectangle(0, 0, width, TOP_BAR_HEIGHT, 0x0a1020).setOrigin(0, 0)
  const topBorder = scene.add.rectangle(0, TOP_BAR_HEIGHT, width, 2, 0x223344).setOrigin(0, 0)
  objects.push(topBg, topBorder)

  const segments = [
    gameState.companyName,
    `Rank ${gameState.rank.name}`,
    `${gameState.credits.toLocaleString()}cr`,
    `GD ${gameState.galaxyDateString}`,
  ]
  // Center each segment in one of four equal-width columns, so the four pieces
  // are evenly spaced with matching half-gaps at each edge.
  segments.forEach((text, i) => {
    const seg = scene.add
      .text((width * (2 * i + 1)) / (segments.length * 2), TOP_BAR_HEIGHT / 2, text, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
    // Name the segments scenes update live: credits (after trades) and the
    // galaxy date (during travel).
    if (i === 2) seg.setName(CREDITS_NAME)
    if (i === segments.length - 1) seg.setName(GALAXY_DATE_NAME)
    objects.push(seg)
  })

  // --- Bottom tab bar ---
  const bottomTop = height - BOTTOM_BAR_HEIGHT
  const bottomBg = scene.add.rectangle(0, bottomTop, width, BOTTOM_BAR_HEIGHT, 0x0a1020).setOrigin(0, 0)
  const bottomBorder = scene.add.rectangle(0, bottomTop - 2, width, 2, 0x223344).setOrigin(0, 0)
  objects.push(bottomBg, bottomBorder)

  let x = 20
  for (const tab of TABS) {
    const isActive = tab.scene === activeScene
    const btn = scene.add
      .text(x, bottomTop + BOTTOM_BAR_HEIGHT / 2, tab.label, {
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

  return objects
}
