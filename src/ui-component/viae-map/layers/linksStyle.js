/**
 * Pure link styling, deck.gl-free -- see nodeStyle.js for why that split
 * matters for testability here.
 */
export function linkColorFor(themeMode) {
    // Low-contrast neutral either way: links are context, not the primary
    // signal, and must not visually compete with routes (Phase 5 requirement).
    return themeMode === 'dark' ? [180, 180, 180, 90] : [90, 90, 90, 90];
}
