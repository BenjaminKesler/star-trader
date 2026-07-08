import Phaser from 'phaser'
import { ZOOM_FRAME_DIST, SYSTEMS, type StarSystem } from '../data/systems'
import { gameState } from '../game/GameState'
import { createTabBar, GALAXY_DATE_NAME } from '../ui/TabBar'
import { FONT_MONO } from '../ui/fonts'

const VIEW_PAD = 135
/** Empty margin (world units) kept around the systems when bounding the camera. */
const MAP_PADDING = 300
/** Pulls the default zoom out a bit so more of the map is visible around the current system. */
const DEFAULT_ZOOM_FACTOR = 0.8
const DRAG_CLICK_THRESHOLD = 6
/** World units per second the travel marker moves along the route. */
const TRAVEL_SPEED = 400
/** Inner padding (screen px) between the hover flyout's text and its border. */
const FLYOUT_PAD_X = 12
const FLYOUT_PAD_Y = 8

/** Unit thresholds (largest first) used to abbreviate fuel amounts, e.g. 1000 -> "k". */
const FUEL_UNITS = [
  { threshold: 1e12, suffix: 't' },
  { threshold: 1e9, suffix: 'b' },
  { threshold: 1e6, suffix: 'm' },
  { threshold: 1e3, suffix: 'k' },
]

/**
 * Formats "current/max" fuel. The unit (k, m, ...) is chosen from the max value,
 * so both numbers share it. Current keeps one decimal unless it rounds clean
 * (5.0k -> 5k); max (always an even unit amount by design) shows none.
 */
function formatFuel(current: number, max: number): string {
  const unit = FUEL_UNITS.find((u) => max >= u.threshold)
  if (!unit) return `${Math.round(current)}/${Math.round(max)}`
  const cur = (current / unit.threshold).toFixed(1).replace(/\.0$/, '')
  const mx = max / unit.threshold
  return `${cur}${unit.suffix}/${mx}${unit.suffix}`
}

export class MapScene extends Phaser.Scene {
  private hud!: Phaser.GameObjects.Text
  private uiCamera!: Phaser.Cameras.Scene2D.Camera
  private stationCircles: Phaser.GameObjects.Arc[] = []
  private stationNames: Phaser.GameObjects.Text[] = []
  private stationStatuses: Phaser.GameObjects.Text[] = []
  private dateText?: Phaser.GameObjects.Text
  private flyout!: Phaser.GameObjects.Container
  private flyoutBg!: Phaser.GameObjects.Rectangle
  private flyoutText!: Phaser.GameObjects.Text
  private homeZoom = 1
  private homeX = 0
  private homeY = 0
  private minZoom = 0.1
  private maxZoom = 4
  private isPointerDown = false
  private pointerOnSystem = false
  private didDrag = false
  private dragLastX = 0
  private dragLastY = 0

  constructor() {
    super('MapScene')
  }

  create() {
    // A prior travel animation disables input; restarting the scene must re-enable it.
    this.input.enabled = true
    this.cameras.main.setBackgroundColor('#000010')

    // Bound the camera to the systems' footprint, expanded to match the viewport's
    // aspect ratio around the cluster center. This keeps the cluster centered when
    // fully zoomed out (Phaser's own bounds clamp only centers the binding axis).
    // Only systems the player has revealed count, so hidden space isn't framed.
    const visibleSystems = SYSTEMS.filter((s) => gameState.isSystemVisible(s.id))
    const xs = visibleSystems.map((s) => s.x)
    const ys = visibleSystems.map((s) => s.y)
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2
    let halfW = (Math.max(...xs) - Math.min(...xs)) / 2 + MAP_PADDING
    let halfH = (Math.max(...ys) - Math.min(...ys)) / 2 + MAP_PADDING
    const viewAspect = this.scale.width / this.scale.height
    if (halfW / halfH < viewAspect) halfW = halfH * viewAspect
    else halfH = halfW / viewAspect
    this.cameras.main.setBounds(centerX - halfW, centerY - halfH, halfW * 2, halfH * 2)

    // Zoom is fixed from the graph's max jump distance (not the current system),
    // so every system frames its neighbors the same consistent way.
    const zoom = Math.min(this.scale.width / 2 / (ZOOM_FRAME_DIST + VIEW_PAD), this.scale.height / 2 / (ZOOM_FRAME_DIST + VIEW_PAD), 1) * DEFAULT_ZOOM_FACTOR
    this.cameras.main.setZoom(zoom)
    this.homeZoom = zoom
    // Don't allow zooming in past the default; allow zooming out until the whole galaxy fits on screen.
    this.maxZoom = zoom
    this.minZoom = Math.min(this.scale.width / (halfW * 2), this.scale.height / (halfH * 2))

    const here = SYSTEMS.find((s) => s.id === gameState.currentSystemId)!
    this.cameras.main.centerOn(here.x, here.y)
    this.homeX = here.x
    this.homeY = here.y

    this.hud = this.add.text(30, 70, '', {
      fontFamily: FONT_MONO,
      fontSize: '24px',
      color: '#9adfff',
    })

    const tabBar = createTabBar(this, this.scene.key)
    this.dateText = tabBar.find((o) => o.name === GALAXY_DATE_NAME) as Phaser.GameObjects.Text

    const flyout = this.createFlyout()

    // A dedicated screen-space camera keeps the HUD/title/tabs crisp and fixed
    // regardless of the main camera's zoom.
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height)
    this.cameras.main.ignore([this.hud, flyout, ...tabBar])

    const visibleIds = new Set(visibleSystems.map((s) => s.id))
    const worldObjects = [
      ...this.drawRoutes(zoom, visibleIds),
      ...this.drawStations(here, zoom, visibleSystems),
    ]
    this.uiCamera.ignore(worldObjects)

    this.refreshHud()
    this.setupCameraControls()

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this)
    })
  }

  private handleResize() {
    this.scene.restart()
  }

  private setupCameraControls() {
    const cam = this.cameras.main

    this.input.on('wheel', (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
      const oldZoom = cam.zoom
      const newZoom = Phaser.Math.Clamp(oldZoom * (dy > 0 ? 0.9 : 1.1), this.minZoom, this.maxZoom)
      if (newZoom === oldZoom) return

      // Keep the world point under the cursor anchored while zooming, so the
      // pointer stays the focal point. Computed directly instead of via a second
      // getWorldPoint call, whose camera matrix wouldn't reflect the new zoom yet.
      const worldPoint = cam.getWorldPoint(pointer.x, pointer.y)
      cam.setZoom(newZoom)
      cam.scrollX = worldPoint.x - cam.width / 2 - (pointer.x - cam.width / 2) / newZoom
      cam.scrollY = worldPoint.y - cam.height / 2 - (pointer.y - cam.height / 2) / newZoom
    })

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isPointerDown = true
      this.didDrag = false
      this.dragLastX = pointer.x
      this.dragLastY = pointer.y
      this.pointerOnSystem = this.input.hitTestPointer(pointer).length > 0
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isPointerDown || this.pointerOnSystem) return

      const dx = pointer.x - this.dragLastX
      const dy = pointer.y - this.dragLastY
      if (!this.didDrag && Math.hypot(pointer.x - pointer.downX, pointer.y - pointer.downY) > DRAG_CLICK_THRESHOLD) {
        this.didDrag = true
      }
      if (this.didDrag) {
        cam.scrollX -= dx / cam.zoom
        cam.scrollY -= dy / cam.zoom
      }
      this.dragLastX = pointer.x
      this.dragLastY = pointer.y
    })

    this.input.on('pointerup', () => {
      if (!this.pointerOnSystem && !this.didDrag) {
        cam.pan(this.homeX, this.homeY, 200, 'Sine.easeInOut')
        cam.zoomTo(this.homeZoom, 200)
      }
      this.isPointerDown = false
      this.didDrag = false
      this.pointerOnSystem = false
    })
  }

  /** Draws jump routes, but only between two revealed systems — a route to a
   * hidden system would give its position away. */
  private drawRoutes(zoom: number, visibleIds: Set<string>): Phaser.GameObjects.GameObject[] {
    const graphics = this.add.graphics()
    const lineWidth = Phaser.Math.Clamp(1.5 / zoom, 1, 6)
    graphics.lineStyle(lineWidth, 0x334455, 0.6)
    const drawn = new Set<string>()
    for (const system of SYSTEMS) {
      if (!visibleIds.has(system.id)) continue
      for (const targetId of system.connections) {
        if (!visibleIds.has(targetId)) continue
        const key = [system.id, targetId].sort().join('|')
        if (drawn.has(key)) continue
        drawn.add(key)
        const target = SYSTEMS.find((s) => s.id === targetId)!
        graphics.lineBetween(system.x, system.y, target.x, target.y)
      }
    }
    return [graphics]
  }

  private drawStations(here: StarSystem, zoom: number, visibleSystems: StarSystem[]): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = []
    const markerScale = 1 / zoom
    // Reset per-run (scene.restart reuses this instance without re-running field initializers).
    this.stationCircles = []
    this.stationNames = []
    this.stationStatuses = []

    for (const system of visibleSystems) {
      const isHere = system.id === here.id
      const licensed = gameState.hasLicense(system.id)
      const isAdjacent = here.connections.includes(system.id)
      // Travel needs a license, an adjacency to the current system, and the fuel.
      const hasFuel = isAdjacent && gameState.jumpFuelCost(system.id) <= gameState.fuel
      const canTravel = isAdjacent && licensed && hasFuel
      const fillColor = isHere ? 0x44ff88 : canTravel ? 0x4488ff : 0x445566

      const circle = this.add.circle(system.x, system.y, 16, fillColor)
      circle.setStrokeStyle(3, isHere || canTravel ? 0xffffff : 0x667788)
      circle.setScale(markerScale)
      objects.push(circle)
      this.stationCircles.push(circle)

      const nameText = this.add
        .text(system.x, system.y - 60 * markerScale, system.name, {
          fontFamily: FONT_MONO,
          fontSize: '21px',
          color: isHere || canTravel ? '#ffffff' : '#778899',
        })
        .setOrigin(0.5)
        .setScale(markerScale)
      objects.push(nameText)
      this.stationNames.push(nameText)

      const statusLabel = isHere
        ? 'DOCKED'
        : canTravel
          ? 'Travel'
          : !licensed
            ? 'License Required'
            : isAdjacent
              ? 'Not Enough Fuel'
              : 'Too Far'
      const statusText = this.add
        .text(system.x, system.y + 51 * markerScale, statusLabel, {
          fontFamily: FONT_MONO,
          fontSize: '18px',
          color: isHere ? '#44ff88' : canTravel ? '#aaaaaa' : '#556677',
        })
        .setOrigin(0.5)
        .setScale(markerScale)
      objects.push(statusText)
      this.stationStatuses.push(statusText)

      if (canTravel) {
        circle.setInteractive({ useHandCursor: true })
        circle.on('pointerdown', () => {
          this.startTravel(here, system, zoom)
        })
        circle.on('pointerover', () => this.showFlyout(system))
        circle.on('pointerout', () => this.hideFlyout())
      }
    }

    return objects
  }

  /**
   * Flies a green marker from the current system to the destination along the
   * route at {@link TRAVEL_SPEED} world units/sec, then commits the jump. All
   * input (other systems and the tab bar, which share this scene's input) is
   * disabled for the duration so the player can't act mid-flight.
   */
  private startTravel(from: StarSystem, to: StarSystem, zoom: number) {
    this.input.enabled = false
    this.hideFlyout()

    // Neutralize the map while in transit: every system goes gray and its
    // status descriptor is hidden, leaving only the moving ship marker lit.
    for (const circle of this.stationCircles) {
      circle.setFillStyle(0x445566)
      circle.setStrokeStyle(3, 0x667788)
    }
    for (const name of this.stationNames) {
      name.setColor('#778899')
    }
    for (const status of this.stationStatuses) {
      status.setVisible(false)
    }

    const markerScale = 1 / zoom
    const traveler = this.add.circle(from.x, from.y, 9, 0x44ff88)
    traveler.setStrokeStyle(2, 0xffffff)
    traveler.setScale(markerScale)
    this.uiCamera.ignore(traveler)

    // Advance the top-bar galaxy date and HUD fuel in step with the ship's
    // progress along the route, landing exactly on the values travelTo() will
    // commit at arrival.
    const startDate = gameState.galaxyDate
    const dateDelta = gameState.jumpDateAdvance(to.id)
    const startFuel = gameState.fuel
    const fuelCost = gameState.jumpFuelCost(to.id)

    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    this.tweens.add({
      targets: traveler,
      x: to.x,
      y: to.y,
      duration: (distance / TRAVEL_SPEED) * 1000,
      ease: 'Linear',
      onUpdate: (tween) => {
        this.dateText?.setText(`GD ${gameState.formatGalaxyDate(startDate + dateDelta * tween.progress)}`)
        this.refreshHud(startFuel - fuelCost * tween.progress)
      },
      onComplete: () => {
        if (gameState.travelTo(to.id)) {
          this.scene.restart()
        } else {
          // Guarded by canTravel already, but stay recoverable if it ever fails.
          traveler.destroy()
          this.input.enabled = true
        }
      },
    })
  }

  /**
   * Builds the (initially hidden) hover flyout: a bordered panel whose bordered
   * background is sized to the text in {@link showFlyout}. Lives in screen space
   * (rendered by the UI camera) so it stays crisp regardless of map zoom.
   */
  private createFlyout(): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, 10, 10, 0x0a1420, 0.95).setOrigin(0, 0.5)
    bg.setStrokeStyle(1.5, 0x4488ff, 0.9)
    const text = this.add
      .text(FLYOUT_PAD_X, 0, '', {
        fontFamily: FONT_MONO,
        fontSize: '18px',
        color: '#cfefff',
      })
      .setOrigin(0, 0.5)
    this.flyoutBg = bg
    this.flyoutText = text
    this.flyout = this.add.container(0, 0, [bg, text]).setDepth(1000).setVisible(false)
    return this.flyout
  }

  /** Shows the travel-cost flyout beside the given (travelable) system. */
  private showFlyout(system: StarSystem) {
    const days = Math.max(1, Math.round(gameState.jumpDateAdvance(system.id)))
    const fuel = gameState.jumpFuelCost(system.id)
    this.flyoutText.setText([
      system.name,
      `${days} day${days === 1 ? '' : 's'}`,
      `${fuel.toLocaleString()} fuel`,
    ].join('\n'))
    this.flyoutBg.setSize(this.flyoutText.width + FLYOUT_PAD_X * 2, this.flyoutText.height + FLYOUT_PAD_Y * 2)

    // Anchor to the system's on-screen position (world -> screen via the main camera).
    const cam = this.cameras.main
    const screenX = (system.x - cam.worldView.x) * cam.zoom
    const screenY = (system.y - cam.worldView.y) * cam.zoom
    this.flyout.setPosition(screenX + 26, screenY).setVisible(true)
  }

  private hideFlyout() {
    this.flyout.setVisible(false)
  }

  /** `fuel` can be overridden to show an in-transit value that isn't committed yet. */
  private refreshHud(fuel = gameState.fuel) {
    this.hud.setText(
      [
        `Ship: ${gameState.shipName}`,
        `Fuel: ${formatFuel(fuel, gameState.maxFuel)}`,
        `Cargo: ${gameState.cargoUsed}/${gameState.cargoCapacity}`,
      ].join('\n'),
    )
  }
}
