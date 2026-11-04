// ============================================================
// PHOTOGRAPHIC GYM MATERIALS AND CAMERA PROJECTION
// ============================================================

import { cameraPoint, type ArenaCamera, type WorldPoint } from "./arena-world.js";
import { loadArtwork } from "./artwork-loading.js";

let photograph: HTMLImageElement | null = null;
let timber: HTMLImageElement | null = null;
let ready = false;
let timberReady = false;
let requested = false;

export function prepareGymArtwork (): void {
    if (requested || typeof Image === "undefined") return;
    requested = true;
    loadArtwork("/art/gym/field-house-panorama.png", (image) => {
        photograph = image;
        ready = true;
    });
    loadArtwork("/art/gym/oak-floor-texture.png", (image) => {
        timber = image;
        timberReady = true;
    });
}
type Vertex = WorldPoint & { u: number; v: number };
type CameraVertex = { side: number; depth: number; z: number; u: number; v: number };
type ScreenVertex = { x: number; y: number; u: number; v: number };
const RADIUS = 900,
    HEIGHT = 570,
    NEAR = 30;

/** Fixed photographic wall and timber-floor UVs, shared by every camera angle. */
export const gymSurfaces: readonly (readonly Vertex[])[] = (() => {
    const surfaces: Vertex[][] = [];
    // A continuous perimeter gives each part of the photograph a fixed bearing.
    for (let side = 0; side < 64; side++)
        for (let row = 0; row < 4; row++) {
            const a = (side / 64) * Math.PI * 2,
                b = ((side + 1) / 64) * Math.PI * 2;
            const low = (row / 4) * HEIGHT,
                high = ((row + 1) / 4) * HEIGHT;
            surfaces.push([
                {
                    x: Math.cos(a) * RADIUS,
                    y: Math.sin(a) * RADIUS,
                    z: low,
                    u: side / 64,
                    v: 0.58 - (row / 4) * 0.58
                },
                {
                    x: Math.cos(b) * RADIUS,
                    y: Math.sin(b) * RADIUS,
                    z: low,
                    u: (side + 1) / 64,
                    v: 0.58 - (row / 4) * 0.58
                },
                {
                    x: Math.cos(b) * RADIUS,
                    y: Math.sin(b) * RADIUS,
                    z: high,
                    u: (side + 1) / 64,
                    v: 0.58 - ((row + 1) / 4) * 0.58
                },
                {
                    x: Math.cos(a) * RADIUS,
                    y: Math.sin(a) * RADIUS,
                    z: high,
                    u: side / 64,
                    v: 0.58 - ((row + 1) / 4) * 0.58
                }
            ]);
        }
    // A top-down material keeps straight planks straight under projection.
    // World-space tiles respond to advance/retreat as well as the orbit.
    for (let col = 0; col < 24; col++)
        for (let row = 0; row < 24; row++) {
            const vertex = (dx: number, dy: number): Vertex => ({
                x: -RADIUS + ((col + dx) / 24) * RADIUS * 2,
                y: -RADIUS + ((row + dy) / 24) * RADIUS * 2,
                z: 0,
                u: ((col % 4) + dx) / 4,
                v: ((row % 4) + dy) / 4
            });
            surfaces.unshift([vertex(0, 0), vertex(1, 0), vertex(1, 1), vertex(0, 1)]);
        }
    return surfaces;
})();

function clipNear (input: CameraVertex[]): CameraVertex[] {
    const out: CameraVertex[] = [];
    for (let i = 0; i < input.length; i++) {
        const a = input[i],
            b = input[(i + 1) % input.length];
        if (a.depth >= NEAR) out.push(a);
        if (a.depth >= NEAR !== b.depth >= NEAR) {
            const t = (NEAR - a.depth) / (b.depth - a.depth);
            out.push({
                side: a.side + (b.side - a.side) * t,
                depth: NEAR,
                z: a.z + (b.z - a.z) * t,
                u: a.u + (b.u - a.u) * t,
                v: a.v + (b.v - a.v) * t
            });
        }
    }
    return out;
}

/** Project a textured triangle using an affine UV-to-screen transform. */
function triangle (c: CanvasRenderingContext2D, image: HTMLImageElement, p: ScreenVertex[]) {
    if (
        p.every((v) => v.x < -85) ||
        p.every((v) => v.x > 1085) ||
        p.every((v) => v.y < -85) ||
        p.every((v) => v.y > 665)
    )
        return;
    const [a, b, d] = p,
        du = b.u - a.u,
        dv = b.v - a.v,
        eu = d.u - a.u,
        ev = d.v - a.v;
    const determinant = du * ev - eu * dv;
    if (Math.abs(determinant) < 0.00001) return;
    const ax = ((b.x - a.x) * ev - (d.x - a.x) * dv) / determinant;
    const bx = ((b.y - a.y) * ev - (d.y - a.y) * dv) / determinant;
    const cx = ((d.x - a.x) * du - (b.x - a.x) * eu) / determinant;
    const dx = ((d.y - a.y) * du - (b.y - a.y) * eu) / determinant;
    c.save();
    c.beginPath();
    // Small overlaps hide anti-aliased cracks between adjacent mesh triangles.
    const center = { x: (a.x + b.x + d.x) / 3, y: (a.y + b.y + d.y) / 3 };
    p.forEach((v, i) => {
        const length = Math.hypot(v.x - center.x, v.y - center.y) || 1;
        const x = v.x + ((v.x - center.x) / length) * 0.65,
            y = v.y + ((v.y - center.y) / length) * 0.65;
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
    });
    c.closePath();
    c.clip();
    c.transform(ax, bx, cx, dx, a.x - ax * a.u - cx * a.v, a.y - bx * a.u - dx * a.v);
    const sx = Math.max(0, Math.min(a.u, b.u, d.u) - 1),
        sy = Math.max(0, Math.min(a.v, b.v, d.v) - 1);
    const sw = Math.min(image.naturalWidth - sx, Math.max(a.u, b.u, d.u) - sx + 1);
    const sh = Math.min(image.naturalHeight - sy, Math.max(a.v, b.v, d.v) - sy + 1);
    c.drawImage(image, sx, sy, sw, sh, sx, sy, sw, sh);
    c.restore();
}

/** Photographic materials on room geometry, viewed by the actual orbit camera. */
export function drawGymPhotograph (c: CanvasRenderingContext2D, camera: ArenaCamera): boolean {
    prepareGymArtwork();
    if (!ready || !photograph || !timberReady || !timber) return false;
    c.save();
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    c.fillStyle = "#302b20";
    c.fillRect(-80, -80, 1160, 740);
    for (const surface of gymSurfaces) {
        const material = surface.every((v) => v.z === 0) ? timber : photograph;
        const vertices = surface.map((v) => ({ ...cameraPoint(camera, v), u: v.u, v: v.v }));
        if (vertices.every((v) => v.depth < NEAR)) continue;
        const clipped = vertices.every((v) => v.depth >= NEAR) ? vertices : clipNear(vertices);
        // Project each shared corner once, then reject whole off-screen faces before
        // allocating triangles. The visible mesh and texture coordinates stay identical.
        const projected = clipped.map((v) => ({
            x: 500 + (v.side * 520) / v.depth,
            y: 210 + ((140 - v.z) * 520) / v.depth,
            u: v.u * material.naturalWidth,
            v: v.v * material.naturalHeight
        }));
        if (
            projected.every((v) => v.x < -85) ||
            projected.every((v) => v.x > 1085) ||
            projected.every((v) => v.y < -85) ||
            projected.every((v) => v.y > 665)
        )
            continue;
        for (let i = 1; i < projected.length - 1; i++)
            triangle(c, material, [projected[0], projected[i], projected[i + 1]]);
    }
    // A structural upright hides the join between the non-seamless photo edges.
    const upright = [
        { x: RADIUS - 8, y: -23, z: 0, u: 0, v: 0 },
        { x: RADIUS - 8, y: 23, z: 0, u: 0, v: 0 },
        { x: RADIUS - 8, y: 23, z: HEIGHT, u: 0, v: 0 },
        { x: RADIUS - 8, y: -23, z: HEIGHT, u: 0, v: 0 }
    ];
    const pillar = clipNear(upright.map((v) => ({ ...cameraPoint(camera, v), u: 0, v: 0 })));
    if (pillar.length >= 3) {
        c.fillStyle = "#344336";
        c.beginPath();
        pillar.forEach((v, i) => {
            const x = 500 + (v.side * 520) / v.depth,
                y = 210 + ((140 - v.z) * 520) / v.depth;
            if (i) c.lineTo(x, y);
            else c.moveTo(x, y);
        });
        c.closePath();
        c.fill();
    }
    c.fillStyle = "#15201612";
    c.fillRect(-80, -80, 1160, 740);
    c.restore();
    return true;
}
