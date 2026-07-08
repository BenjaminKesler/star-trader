import Phaser from 'phaser'
import { createTabBar } from '../ui/TabBar'
import { gameState } from '../game/GameState'
import { FONT_DISPLAY, FONT_MONO } from '../ui/fonts'
import { EM_DASH } from '../ui/format'

const ROW_HEIGHT = 56
const TABLE_TOP = 200
const TABLE_MAX_WIDTH = 900
const TABLE_MARGIN = 40
/** Inset from each table edge to the label / value columns. */
const COLUMN_INSET = 26
/** Extra gap before the cargo-balance row, which is a balance rather than a monthly flow. */
const SECTION_GAP = 22

const ROW_COLOR_EVEN = 0x0c1424
const ROW_COLOR_ODD = 0x121d33
const TOTAL_ROW_COLOR = 0x1c2c44
const BALANCE_ROW_COLOR = 0x16233a

type RowKind = 'cost' | 'total' | 'balance'

interface BudgetRow {
  label: string
  value: number | null
  kind: RowKind
  /** A small note shown under the label, e.g. explaining what a line means. */
  note?: string
}

/**
 * The Budget page. Shows the ship's running costs as a trailing average — each
 * cost line is the average spend per 30-day month over the past year (dividing
 * only by the days actually elapsed early on, so opening days aren't diluted by
 * pre-game zeros). Below the cost total sits the average capital tied up in
 * cargo — a balance, not a flow. On the very first day, before anything has been
 * spent, every figure reads as an em dash.
 */
export class BudgetScene extends Phaser.Scene {
  constructor() {
    super('BudgetScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#000010')
    createTabBar(this, this.scene.key)

    const centerX = this.scale.width / 2

    this.add
      .text(centerX, 75, 'Budget', {
        fontFamily: FONT_DISPLAY,
        fontStyle: 'bold',
        fontSize: '36px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0)

    this.add
      .text(centerX, 132, 'Monthly average  ·  1-year trailing', {
        fontFamily: FONT_MONO,
        fontSize: '22px',
        color: '#7a93b8',
      })
      .setOrigin(0.5, 0)

    const rows = this.buildRows()

    const tableWidth = Math.min(TABLE_MAX_WIDTH, this.scale.width - TABLE_MARGIN * 2)
    const tableLeft = centerX - tableWidth / 2
    const labelX = tableLeft + COLUMN_INSET
    const valueX = tableLeft + tableWidth - COLUMN_INSET

    let y = TABLE_TOP
    rows.forEach((row, i) => {
      // Set the cargo-balance section off from the monthly cost flows above it.
      if (row.kind === 'balance') y += SECTION_GAP

      const fill =
        row.kind === 'total'
          ? TOTAL_ROW_COLOR
          : row.kind === 'balance'
            ? BALANCE_ROW_COLOR
            : i % 2 === 0
              ? ROW_COLOR_EVEN
              : ROW_COLOR_ODD
      const band = this.add.rectangle(tableLeft, y, tableWidth, ROW_HEIGHT, fill).setOrigin(0, 0)
      if (row.kind === 'total') band.setStrokeStyle(2, 0x3a5a8a)

      const emphasized = row.kind === 'total'
      const labelColor = emphasized ? '#ffffff' : '#cfe0f5'
      const centerY = y + ROW_HEIGHT / 2
      const labelY = row.note ? centerY - 10 : centerY

      this.add
        .text(labelX, labelY, row.label, {
          fontFamily: FONT_MONO,
          fontStyle: emphasized ? 'bold' : 'normal',
          fontSize: '24px',
          color: labelColor,
        })
        .setOrigin(0, 0.5)

      if (row.note) {
        this.add
          .text(labelX, centerY + 13, row.note, {
            fontFamily: FONT_MONO,
            fontSize: '16px',
            color: '#6f86a6',
          })
          .setOrigin(0, 0.5)
      }

      const valueStr = row.value === null ? EM_DASH : `${Math.round(row.value).toLocaleString()}cr`
      this.add
        .text(valueX, centerY, valueStr, {
          fontFamily: FONT_MONO,
          fontStyle: emphasized ? 'bold' : 'normal',
          fontSize: '24px',
          color: row.value === null ? '#7a93b8' : emphasized ? '#9adfff' : '#e6eefc',
        })
        .setOrigin(1, 0.5)

      y += ROW_HEIGHT
    })

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this)
    })
  }

  private handleResize() {
    this.scene.restart()
  }

  /** Assembles the budget lines for this visit, folding in restitution only when it's being paid. */
  private buildRows(): BudgetRow[] {
    const fuel = gameState.budgetMonthlyAverage('fuel')
    const crew = gameState.budgetMonthlyAverage('crew')
    const repairs = gameState.budgetMonthlyAverage('repairs')
    const restitution = gameState.budgetMonthlyAverage('restitution')

    const rows: BudgetRow[] = [
      { label: 'Fuel', value: fuel, kind: 'cost' },
      { label: 'Crew Pay', value: crew, kind: 'cost' },
      { label: 'Ship Repairs', value: repairs, kind: 'cost' },
    ]

    // Restitution only appears while wages are still owed to a crew member's family.
    if (gameState.hasActiveRestitution) {
      rows.push({
        label: 'Restitution',
        value: restitution,
        kind: 'cost',
        note: "Wages owed to deceased crew's next of kin",
      })
    }

    // Total monthly spend. Null (em dash) before any days have elapsed; otherwise
    // the sum of every cost flow, restitution included.
    const total =
      gameState.budgetElapsedDays <= 0
        ? null
        : (fuel ?? 0) + (crew ?? 0) + (repairs ?? 0) + (restitution ?? 0)
    rows.push({ label: 'Total', value: total, kind: 'total' })

    rows.push({
      label: 'Cargo Capital',
      value: gameState.cargoAverageBalance(),
      kind: 'balance',
      note: 'Average funds tied up in held inventory',
    })

    return rows
  }
}
