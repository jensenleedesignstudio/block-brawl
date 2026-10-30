/** Material pass for the existing cutouts. Runs once per atlas/corner at load.
 * Only blue leather pixels change; alpha, skin, cloth and sprite geometry stay exact.
 */
export function shadeLeather (data: Uint8ClampedArray, width: number, redCorner: boolean) {
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i],
            g = data[i + 1],
            b = data[i + 2];
        if (!data[i + 3] || g <= r * 1.05 || b <= r * 1.22 || b <= g * 1.08 || b - r <= 24)
            continue;
        const pixel = i / 4,
            x = pixel % width,
            y = Math.floor(pixel / width);
        // Fine deterministic leather grain retains the authored large highlights.
        // No randomness, per-frame noise, resampling or silhouette expansion.
        const grain = (((x * 13 + y * 7) % 11) - 5) * 0.32;
        if (redCorner) {
            data[i] = Math.min(255, b * 1.04 + grain);
            data[i + 1] = r * 0.52 + g * 0.19 + grain;
            data[i + 2] = g * 0.47 + r * 0.24 + grain;
        } else {
            data[i] = r * 0.82 + g * 0.08 + grain;
            data[i + 1] = g * 0.9 + b * 0.06 + grain;
            data[i + 2] = b * 0.92 + 8 + grain;
        }
    }
}
