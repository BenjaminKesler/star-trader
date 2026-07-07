export const UP_ARROW = '▲'
export const DOWN_ARROW = '▼'
export const EM_DASH = '—'

/** Formats a percentage change with an up/down arrow, or an em dash at zero. */
export function formatDelta(percent: number): string {
  if (percent === 0) return EM_DASH
  const arrow = percent > 0 ? UP_ARROW : DOWN_ARROW
  return `${arrow}${Math.abs(percent)}%`
}
