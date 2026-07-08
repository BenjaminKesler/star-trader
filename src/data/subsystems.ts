/**
 * The four ship subsystems that take wear during travel. Each carries an
 * integrity value from 0 to {@link SUBSYSTEM_MAX}; a fresh ship starts every one
 * at full. Integrity, damage rates, and the effects of wear all live in
 * {@link ../game/GameState}; this module just names the systems for the UI.
 */

export type SubsystemId = 'life-support' | 'engines' | 'hull' | 'sensors'

export interface Subsystem {
  id: SubsystemId
  name: string
  /** One-line summary of what wear on this system does, shown at the Depot. */
  description: string
}

/** Full integrity. Every subsystem is measured on a 0–100 scale. */
export const SUBSYSTEM_MAX = 100

export const SUBSYSTEMS: Subsystem[] = [
  {
    id: 'life-support',
    name: 'Life Support',
    description: 'Keeps the crew alive. At 0, the crew begin to die.',
  },
  {
    id: 'engines',
    name: 'Engines',
    description: 'Wear slows every jump; at 0 the ship cannot travel.',
  },
  {
    id: 'hull',
    name: 'Hull',
    description: 'Damage trims cargo capacity; at 0 the ship cannot travel.',
  },
  {
    id: 'sensors',
    name: 'Sensors',
    description: 'Wear hides distant systems; at 0 no neighbors are visible.',
  },
]

/** All subsystem ids, in display order. */
export const SUBSYSTEM_IDS: SubsystemId[] = SUBSYSTEMS.map((s) => s.id)

export const SUBSYSTEM_BY_ID: Record<SubsystemId, Subsystem> = SUBSYSTEMS.reduce(
  (map, subsystem) => {
    map[subsystem.id] = subsystem
    return map
  },
  {} as Record<SubsystemId, Subsystem>,
)
