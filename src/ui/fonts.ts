/**
 * The game's two type roles. Both list a generic fallback so text still renders
 * if the web font hasn't loaded yet (see BootScene, which waits for both before
 * starting the game so this fallback is only ever hit on the splash).
 */

/** Display face for the boot splash and scene titles — angular sci-fi character. */
export const FONT_DISPLAY = "'Chakra Petch', sans-serif"

/**
 * UI + data face for everything else. Monospace so the market and finances
 * tables keep their digits column-aligned.
 */
export const FONT_MONO = "'JetBrains Mono', monospace"
