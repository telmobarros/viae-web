/**
 * Shared visualization palette.
 *
 * Replaces two independent, duplicated palettes (LiveRoutes.jsx's 5-colour
 * RGB array and VRPVisualizer's 10-colour CSS-name array) so a given route
 * index reads the same colour in every view.
 *
 * Colours are [r,g,b] because that is what deck.gl accessors want; `cssColor`
 * converts for MUI chips/swatches so the sidebar always matches the canvas.
 */

// Categorical, reasonably distinguishable, and stable under both themes.
export const ROUTE_PALETTE = [
    [25, 118, 210], // blue
    [255, 143, 0], // amber
    [67, 160, 71], // green
    [216, 27, 96], // pink
    [142, 36, 170], // purple
    [0, 172, 193], // cyan
    [244, 81, 30], // deep orange
    [121, 85, 72], // brown
    [57, 73, 171], // indigo
    [124, 179, 66] // light green
];

export const NODE_COLORS = {
    depot: [229, 57, 53],
    station: [255, 179, 0],
    customer: [25, 118, 210],
    unserved: [144, 164, 174]
};

/** Deterministic per-index route colour. */
export function routeColor(index) {
    return ROUTE_PALETTE[Math.abs(index) % ROUTE_PALETTE.length];
}

/** [r,g,b] -> CSS, for MUI swatches next to the canvas. */
export function cssColor(rgb, alpha = 1) {
    if (!rgb) return 'transparent';
    const [r, g, b] = rgb;
    return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Append an alpha channel for deck.gl accessors. */
export function withAlpha(rgb, alpha) {
    return [rgb[0], rgb[1], rgb[2], Math.round(alpha * 255)];
}
