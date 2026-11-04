type Rectangle = { left: number; top: number; right: number; bottom: number };

/** Include the afterimage trail and upward fade when reserving room around a ghost. */
export function placeActionGhost (
    width: number,
    height: number,
    compact: boolean,
    obstacles: Rectangle[],
    random = Math.random
) {
    const ghostWidth = compact ? 110 : 150;
    const ghostHeight = compact ? 180 : 220;
    const margin = 36;
    const columns = Math.max(0, Math.floor((width - ghostWidth - margin * 2) / 24) + 1);
    const rows = Math.max(0, Math.floor((height - ghostHeight - margin * 2) / 24) + 1);
    const count = columns * rows;
    const start = Math.floor(random() * count);
    // Start at a random cell and stop at the first fit. Avoid constructing an
    // entire screen-sized list of candidate objects on every accepted punch.
    for (let offset = 0; offset < count; offset++) {
        const cell = (start + offset) % count;
        const x = margin + (cell % columns) * 24;
        const y = margin + Math.floor(cell / columns) * 24;
        if (
            obstacles.every(
                (box) =>
                    x + ghostWidth + margin <= box.left ||
                    x - margin >= box.right ||
                    y + ghostHeight + margin <= box.top ||
                    y - margin >= box.bottom
            )
        )
            return { x, y };
    }
    // A crowded viewport may omit a cosmetic echo; combat is never affected.
    return null;
}
