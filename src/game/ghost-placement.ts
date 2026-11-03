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
    const positions: { x: number; y: number }[] = [];
    for (let y = margin; y <= height - ghostHeight - margin; y += 24) {
        for (let x = margin; x <= width - ghostWidth - margin; x += 24) {
            if (
                obstacles.every(
                    (box) =>
                        x + ghostWidth + margin <= box.left ||
                        x - margin >= box.right ||
                        y + ghostHeight + margin <= box.top ||
                        y - margin >= box.bottom
                )
            )
                positions.push({ x, y });
        }
    }
    // A crowded viewport may omit a cosmetic echo; combat is never affected.
    return positions[Math.floor(random() * positions.length)] ?? null;
}
