import type { ProjectColor, ProjectColorKey } from './types'

/**
 * Resolve a stored project color to a CSS background value. Hex strings (the
 * custom-picker output) pass through; palette keys go through the CSS var.
 */
export function colorBg(color: ProjectColor): string {
  return color.startsWith('#') ? color : `var(--color-plot-${color})`
}

// 24 swatches in row-major order, designed to render as a 6×4 grid that
// walks each row from saturated/dark on the left to pale on the right:
// row 1 warm, row 2 purples/pinks, row 3 blues/teals, row 4 greens/olives.
export const PALETTE: { key: ProjectColorKey; label: string }[] = [
  // Row 1 — warm
  { key: 'terracotta', label: 'Terracotta' },
  { key: 'sienna', label: 'Sienna' },
  { key: 'amber', label: 'Amber' },
  { key: 'mustard', label: 'Mustard' },
  { key: 'wheat', label: 'Wheat' },
  { key: 'cream', label: 'Cream' },
  // Row 2 — purples / pinks
  { key: 'iris', label: 'Iris' },
  { key: 'lilac', label: 'Lilac' },
  { key: 'lavender', label: 'Lavender' },
  { key: 'blush', label: 'Blush' },
  { key: 'rose', label: 'Rose' },
  { key: 'mauve', label: 'Mauve' },
  // Row 3 — blues / teals
  { key: 'denim', label: 'Denim' },
  { key: 'chambray', label: 'Chambray' },
  { key: 'sky', label: 'Sky' },
  { key: 'mist', label: 'Mist' },
  { key: 'seafoam', label: 'Seafoam' },
  { key: 'jade', label: 'Jade' },
  // Row 4 — greens / olives
  { key: 'forest', label: 'Forest' },
  { key: 'sage', label: 'Sage' },
  { key: 'celadon', label: 'Celadon' },
  { key: 'olive', label: 'Olive' },
  { key: 'moss', label: 'Moss' },
  { key: 'ochre', label: 'Ochre' },
]
