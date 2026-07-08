import Phaser from 'phaser'
import { gameState } from '../game/GameState'
import { SUBSYSTEM_IDS } from '../data/subsystems'
import { FONT_DISPLAY, FONT_MONO } from './fonts'

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
  { label: 'Budget', scene: 'BudgetScene' },
  { label: 'Shipyard', scene: 'ShipyardScene' },
  { label: 'Outfitter', scene: 'OutfitterScene' },
  { label: 'Depot', scene: 'DepotScene' },
]

/** Object name of the top-bar galaxy-date text, so scenes can find and update it live. */
export const GALAXY_DATE_NAME = 'galaxyDate'

/** A single entry in the hidden cheats menu — a label and the effect it applies. */
interface Cheat {
  label: string
  apply: () => void
}

/**
 * Developer cheats, reached via the small toggle at the far right of the top
 * bar. Purely a testing aid. Applying one restarts the current scene so every
 * on-screen readout (top bar, per-scene HUDs) reflects the change at once.
 */
const CHEATS: Cheat[] = [
  {
    label: `Give ${(1_000_000_000_000).toLocaleString()}cr`,
    apply: () => {
      gameState.credits += 1_000_000_000_000
    },
  },
  {
    label: 'Unlock all travel licenses',
    apply: () => {
      gameState.grantAllLicenses()
    },
  },
  {
    label: 'Hire 5 crew',
    apply: () => {
      gameState.crew += 5
    },
  },
  {
    label: 'Damage all systems (−40)',
    apply: () => {
      for (const id of SUBSYSTEM_IDS) {
        gameState.subsystems[id] = Math.max(0, gameState.subsystems[id] - 40)
      }
    },
  },
  {
    label: 'Fail life support',
    apply: () => {
      gameState.subsystems['life-support'] = 0
    },
  },
]

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
        fontFamily: FONT_MONO,
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
        fontFamily: FONT_MONO,
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

  objects.push(...createCheatsMenu(scene))

  return objects
}

/**
 * Builds the hidden developer cheats menu and its toggle. The toggle is a small,
 * unobtrusive glyph at the far right of the top bar; clicking it shows an overlay
 * with one button per {@link CHEATS} entry. Returns the toggle and the overlay
 * container so the caller can fold them into any camera-ignore lists.
 */
function createCheatsMenu(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  const width = scene.scale.width
  const height = scene.scale.height

  // --- Overlay panel (hidden until toggled) ---
  const backdrop = scene.add
    .rectangle(0, 0, width, height, 0x000000, 0.6)
    .setOrigin(0, 0)
    .setInteractive()

  const panelW = 600
  const panelH = 70 + CHEATS.length * 60 + 20
  const cx = width / 2
  const cy = height / 2
  const panelTop = cy - panelH / 2

  const panel = scene.add
    .rectangle(cx, cy, panelW, panelH, 0x0a1020)
    .setStrokeStyle(2, 0x2a4a6a)
    .setInteractive() // absorbs clicks so tapping inside the panel doesn't close it

  const title = scene.add
    .text(cx, panelTop + 28, 'Cheats', {
      fontFamily: FONT_DISPLAY,
      fontStyle: 'bold',
      fontSize: '28px',
      color: '#ffffff',
    })
    .setOrigin(0.5)

  const closeBtn = scene.add
    .text(cx + panelW / 2 - 16, panelTop + 22, '×', {
      fontFamily: FONT_MONO,
      fontSize: '28px',
      color: '#7a8ba0',
    })
    .setOrigin(1, 0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', () => closeBtn.setColor('#ffffff'))
    .on('pointerout', () => closeBtn.setColor('#7a8ba0'))

  const children: Phaser.GameObjects.GameObject[] = [backdrop, panel, title, closeBtn]

  CHEATS.forEach((cheat, i) => {
    const btn = scene.add
      .text(cx, panelTop + 70 + i * 60, cheat.label, {
        fontFamily: FONT_MONO,
        fontSize: '22px',
        color: '#66ccff',
        backgroundColor: '#112233',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => btn.setBackgroundColor('#1c3a55'))
      .on('pointerout', () => btn.setBackgroundColor('#112233'))
      .on('pointerdown', () => {
        cheat.apply()
        scene.scene.restart()
      })
    children.push(btn)
  })

  const overlay = scene.add.container(0, 0, children).setDepth(2000).setVisible(false)

  const close = () => overlay.setVisible(false)
  backdrop.on('pointerdown', close)
  closeBtn.on('pointerdown', close)
  panel.on('pointerdown', () => {}) // no-op: keep the menu open on in-panel clicks

  // --- Toggle: a small, quiet glyph pinned to the far right of the top bar ---
  const toggle = scene.add
    .text(width - 10, TOP_BAR_HEIGHT / 2, '≡', {
      fontFamily: FONT_MONO,
      fontSize: '22px',
      color: '#3a4a60',
      backgroundColor: '#0f1826',
      padding: { x: 9, y: 4 },
    })
    .setOrigin(1, 0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', () => toggle.setColor('#9adfff'))
    .on('pointerout', () => toggle.setColor('#3a4a60'))
    .on('pointerdown', () => overlay.setVisible(!overlay.visible))

  return [overlay, toggle]
}
