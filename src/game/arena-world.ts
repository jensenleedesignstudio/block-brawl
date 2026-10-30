// ============================================================
// GYM SCENERY AND CAMERA PROJECTION
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { ringPositions, type Match } from "../../shared/combat.js";
import { drawGymPhotograph } from "./gym-photography.js";

// ------------------------------------------------------------
// TYPES AND SHARED DATA STRUCTURES
// ------------------------------------------------------------

export interface WorldPoint {
    x: number;
    y: number;
    z: number;
}
export interface ArenaCamera {
    x: number;
    y: number;
    forwardX: number;
    forwardY: number;
}

// ------------------------------------------------------------
// POSITION THE CAMERA BEHIND THE CURRENT FIGHTER
// ------------------------------------------------------------

export function arenaCamera (m: Match, viewIndex: 0 | 1): ArenaCamera {
    const self = ringPositions(m)[viewIndex];

    const forwardX = Math.cos(self.facing),
        forwardY = Math.sin(self.facing);

    return { x: self.x - forwardX * 180, y: self.y - forwardY * 180, forwardX, forwardY };
}

// ------------------------------------------------------------
// CONVERT WORLD COORDINATES INTO CAMERA COORDINATES
// ------------------------------------------------------------

export function cameraPoint (camera: ArenaCamera, p: WorldPoint) {
    const dx = p.x - camera.x,
        dy = p.y - camera.y;

    return {
        side: dx * -camera.forwardY + dy * camera.forwardX,
        depth: dx * camera.forwardX + dy * camera.forwardY,
        z: p.z
    };
}

// ------------------------------------------------------------
// PROJECT A WORLD POINT ONTO THE ARENA SCREEN
// ------------------------------------------------------------

export function projectPoint (camera: ArenaCamera, p: WorldPoint) {
    const q = cameraPoint(camera, p),
        scale = 520 / Math.max(20, q.depth);

    return { x: 500 + q.side * scale, y: 210 + (140 - q.z) * scale, scale, depth: q.depth };
}

// ------------------------------------------------------------
// CLIP AND SHADE SCENERY BEFORE DRAWING
// ------------------------------------------------------------

// Clip geometry against the camera before perspective division, including floor
// tiles crossing behind the player. This prevents flips during a full revolution.
function polygon (
    c: CanvasRenderingContext2D,
    camera: ArenaCamera,
    points: WorldPoint[],
    color: string
) {
    const input = points.map((p) => cameraPoint(camera, p)),
        out: typeof input = [];

    for (let i = 0; i < input.length; i++) {
        const a = input[i],
            b = input[(i + 1) % input.length],
            inside = a.depth >= 20,
            next = b.depth >= 20;

        if (inside) out.push(a);

        if (inside !== next) {
            const t = (20 - a.depth) / (b.depth - a.depth);

            out.push({ side: a.side + (b.side - a.side) * t, depth: 20, z: a.z + (b.z - a.z) * t });
        }
    }

    if (out.length < 3) return;

    const depth = out.reduce((sum, p) => sum + p.depth, 0) / out.length;

    const fog = Math.min(0.45, Math.max(0, (depth - 380) / 1400));

    if (/^#[0-9a-f]{6}$/i.test(color)) {
        const haze = [58, 49, 34];

        c.fillStyle = `rgb(${[1, 3, 5].map((offset, i) => Math.round(parseInt(color.slice(offset, offset + 2), 16) * (1 - fog) + haze[i] * fog)).join(",")})`;
    } else c.fillStyle = color;

    c.beginPath();

    out.forEach((p, i) => {
        const x = 500 + (p.side * 520) / p.depth,
            y = 210 + ((140 - p.z) * 520) / p.depth;

        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
    });

    c.closePath();

    c.fill();
}

// ------------------------------------------------------------
// DRAW THE VINTAGE MILITARY BOXING GYM
// ------------------------------------------------------------

function drawRoom (c: CanvasRenderingContext2D, camera: ArenaCamera) {
    if (drawGymPhotograph(c, camera)) return;
    c.fillStyle = "#29261d";
    c.fillRect(-80, -80, 1160, 740);
    // World-anchored timber planks preserve parallax through a complete orbit.
    for (let x = -720; x < 720; x += 90)
        for (let y = -720; y < 720; y += 180) {
            const tone = Math.abs(x / 90 + y / 180) % 4;
            polygon(
                c,
                camera,
                [
                    { x, y, z: 0 },
                    { x: x + 88, y, z: 0 },
                    { x: x + 88, y: y + 178, z: 0 },
                    { x, y: y + 178, z: 0 }
                ],
                ["#715035", "#805e3c", "#65462f", "#8a6742"][tone]
            );
            for (let grain = 0; grain < 3; grain++) {
                const gx = x + 12 + grain * 24;
                polygon(
                    c,
                    camera,
                    [
                        { x: gx, y: y + 12, z: 0.2 },
                        { x: gx + 2, y: y + 12, z: 0.2 },
                        { x: gx + 2, y: y + 144, z: 0.2 },
                        { x: gx, y: y + 144, z: 0.2 }
                    ],
                    tone % 2 ? "#a17a4c" : "#513b29"
                );
            }
        }
    // Draw rear walls first; the geometry remains fixed as fighters circle.
    const walls = Array.from({ length: 4 }, (_, side) => {
        const a = (side * Math.PI) / 2;
        return {
            side,
            a,
            depth: cameraPoint(camera, { x: Math.cos(a) * 640, y: Math.sin(a) * 640, z: 0 }).depth
        };
    }).sort((a, b) => b.depth - a.depth);
    for (const { side, a, depth } of walls) {
        if (depth < 20) continue;
        const point = (u: number, z: number, inset = 0): WorldPoint => ({
            x: Math.cos(a) * (640 - inset) - Math.sin(a) * u,
            y: Math.sin(a) * (640 - inset) + Math.cos(a) * u,
            z
        });
        const rect = (u: number, z: number, w: number, h: number, color: string, inset = 0) =>
            polygon(
                c,
                camera,
                [
                    point(u, z, inset),
                    point(u + w, z, inset),
                    point(u + w, z + h, inset),
                    point(u, z + h, inset)
                ],
                color
            );
        rect(-640, 0, 1280, 540, "#837058");
        // Mortar courses, scuffed plaster and dark green tongue-and-groove panels.
        for (let z = 165; z < 540; z += 34) {
            rect(-640, z, 1280, 2, "#675b48", 1);
            for (let u = -640; u < 640; u += 95)
                rect(u + (z % 68 ? 40 : 0), z, 2, 34, "#74664f", 2);
        }
        rect(-640, 0, 1280, 158, "#293d32", 3);
        for (let u = -640; u < 640; u += 30) {
            rect(u, 0, 2, 158, "#14271f", 4);
            rect(u + 3, 0, 1, 158, "#4c5a42", 4);
        }
        rect(-640, 153, 1280, 9, "#9c8050", 5);
        rect(-640, 0, 1280, 13, "#211f17", 6);
        // Heavy ceiling beams and iron uprights.
        rect(-640, 475, 1280, 25, "#30291e", 8);
        rect(-640, 471, 1280, 4, "#b28a51", 9);
        for (let u = -620; u < 640; u += 310) {
            rect(u, 0, 12, 540, "#26291f", 10);
            rect(u + 2, 0, 3, 470, "#9a7d49", 11);
        }
        for (let panel = 0; panel < 4; panel++) {
            const u = -600 + panel * 310;
            if ((side + panel) % 3 === 0) {
                // Tall amber windows, steel mullions and light on the floor.
                rect(u, 185, 225, 258, "#302e23", 12);
                rect(u + 7, 192, 211, 244, "#c09559", 13);
                for (let col = 0; col < 3; col++)
                    for (let row = 0; row < 4; row++) {
                        rect(
                            u + 13 + col * 68,
                            200 + row * 58,
                            60,
                            50,
                            row > 1 ? "#f3d99b" : "#c8ad76",
                            14
                        );
                        rect(u + 16 + col * 68, 203 + row * 58, 2, 43, "#fff0bd", 15);
                    }
                polygon(
                    c,
                    camera,
                    [
                        point(u + 7, 195, 15),
                        point(u + 218, 195, 15),
                        point(u + 380, 0, 500),
                        point(u + 140, 0, 500)
                    ],
                    "#f8d38712"
                );
            } else {
                // Framed cream fight bills with a printed boxer silhouette.
                rect(u + 24, 218, 164, 192, "#25241c", 12);
                rect(u + 29, 223, 154, 182, "#b39156", 13);
                rect(u + 34, 228, 144, 172, "#c6b58b", 14);
                const sign = projectPoint(camera, point(u + 106, 375, 16));
                if (sign.depth > 40 && sign.x > -250 && sign.x < 1250) {
                    c.save();
                    c.translate(sign.x, sign.y);
                    c.scale(sign.scale, sign.scale);
                    c.fillStyle = "#32372a";
                    c.textAlign = "center";
                    c.font = "bold 13px monospace";
                    c.fillText(
                        ["TRAIN HARD", "THE FIGHT CLUB", "DISCIPLINE", "ROUND ONE"][
                            (panel + side) % 4
                        ],
                        0,
                        0
                    );
                    c.font = "bold 8px monospace";
                    c.fillText("NO SHORTCUTS", 0, 17);
                    c.fillRect(-13, 39, 26, 19);
                    c.fillRect(-25, 62, 50, 35);
                    c.fillRect(-34, 66, 12, 24);
                    c.fillRect(22, 66, 12, 24);
                    c.fillRect(-22, 100, 17, 27);
                    c.fillRect(5, 100, 17, 27);
                    c.restore();
                }
            }
            // Benches and equipment trunks sit along the wainscot.
            rect(u + 15, 34, 175, 12, "#493523", 55);
            rect(u + 15, 46, 175, 5, "#ab8150", 56);
            rect(u + 28, 0, 9, 34, "#28281f", 52);
            rect(u + 164, 0, 9, 34, "#28281f", 52);
            if (panel % 2) {
                rect(u + 205, 0, 65, 56, "#3c4933", 35);
                rect(u + 210, 8, 55, 39, "#4c553b", 36);
                rect(u + 231, 20, 12, 7, "#b69a60", 37);
            }
            // Chain-hung stitched leather bags. Thick pixel facets, brass fittings.
            if ((side + panel) % 2 === 0) {
                const b = u + 205;
                for (let z = 350; z < 475; z += 11) {
                    rect(b + 22, z, 5, 8, "#171c16", 60);
                    rect(b + 24, z + 2, 3, 4, "#ad9563", 61);
                }
                rect(b + 4, 177, 46, 174, "#281b15", 60);
                rect(b, 189, 54, 145, "#583522", 61);
                rect(b + 6, 184, 42, 158, "#70442a", 62);
                rect(b + 11, 192, 7, 140, "#a26a3c", 63);
                rect(b + 43, 193, 4, 137, "#38271d", 64);
                rect(b + 4, 210, 46, 4, "#ad8553", 65);
                rect(b + 4, 310, 46, 4, "#ad8553", 65);
                for (let z = 223; z < 302; z += 9) rect(b + 34, z, 5, 2, "#c49e68", 66);
            }
        }
        // Overhead pendant lights and broad pools of warm light.
        for (const u of [-340, 300]) {
            rect(u, 416, 3, 65, "#24271f", 90);
            rect(u - 22, 403, 46, 12, "#20281e", 90);
            rect(u - 14, 398, 30, 5, "#ffe5a3", 91);
            rect(u - 23, 393, 48, 4, "#eebd6025", 92);
        }
        // The far ring rails frame the fighter without obscuring the sprites.
        rect(-450, 0, 16, 159, "#622a20", 200);
        rect(434, 0, 16, 159, "#622a20", 200);
        rect(-448, 0, 4, 156, "#b36237", 201);
        rect(436, 0, 4, 156, "#b36237", 201);
        for (const z of [52, 91, 130]) {
            rect(-434, z - 3, 868, 7, "#351e18", 200);
            rect(-434, z, 868, 3, z === 91 ? "#d4b98a" : "#9a3a29", 201);
        }
    }
    // Soft edge vignette leaves the center readable and blue gloves prominent.
    c.fillStyle = "#131c1618";
    c.fillRect(-80, -80, 1160, 740);
}

// Decorative paint lies on the existing floor. No new world/collision geometry.
// Cache vertices, rather than allocating or tessellating them every frame.
const floorInlay: { points: WorldPoint[]; color: string }[] = (() => {
    const marks: { points: WorldPoint[]; color: string }[] = [];
    for (const radius of [105, 115]) {
        for (let i = 0; i < 48; i++) {
            const a = (i / 48) * Math.PI * 2,
                b = ((i + 0.82) / 48) * Math.PI * 2;
            const point = (r: number, angle: number): WorldPoint => ({
                x: Math.cos(angle) * r,
                y: Math.sin(angle) * r,
                z: 0.1
            });
            marks.push({
                points: [
                    point(radius, a),
                    point(radius + 1.5, a),
                    point(radius + 1.5, b),
                    point(radius, b)
                ],
                color: "#dfc89032"
            });
        }
    }
    // Four restrained brass-colored chevrons form the field-house floor crest.
    for (let side = 0; side < 4; side++) {
        const a = (side * Math.PI) / 2;
        marks.push({
            points: [
                [-30, 36],
                [0, 64],
                [30, 36],
                [0, 48]
            ].map(([x, y]) => ({
                x: x * Math.cos(a) - y * Math.sin(a),
                y: x * Math.sin(a) + y * Math.cos(a),
                z: 0.1
            })),
            color: "#eed8a13a"
        });
    }
    return marks;
})();
let atmosphere: HTMLCanvasElement | undefined;

/** One cached light pass: warm key light and cool edges, behind the fighters. */
function drawAtmosphere (c: CanvasRenderingContext2D) {
    if (!atmosphere && typeof document !== "undefined") {
        atmosphere = document.createElement("canvas");
        atmosphere.width = 1000;
        atmosphere.height = 580;
        const light = atmosphere.getContext("2d");
        if (light) {
            const key = light.createRadialGradient(390, 70, 10, 430, 180, 460);
            key.addColorStop(0, "#ffdf9d16");
            key.addColorStop(1, "#ffdf9d00");
            light.fillStyle = key;
            light.fillRect(0, 0, 1000, 580);
            const edges = light.createRadialGradient(500, 280, 180, 500, 280, 610);
            edges.addColorStop(0, "#0b202600");
            edges.addColorStop(0.65, "#0b202618");
            edges.addColorStop(1, "#09191f75");
            light.fillStyle = edges;
            light.fillRect(0, 0, 1000, 580);
        }
    }
    if (atmosphere) c.drawImage(atmosphere, 0, 0);
}

export function drawWorld (c: CanvasRenderingContext2D, camera: ArenaCamera) {
    c.save();
    drawRoom(c, camera);
    for (const mark of floorInlay) polygon(c, camera, mark.points, mark.color);
    drawAtmosphere(c);
    c.restore();
}
