import { shadeLeather } from "./sprite-material.js";

// ============================================================
// ARTWORK LOADING AND ANIMATED SPRITE RIGS
// ============================================================

// ------------------------------------------------------------
// TYPES AND SHARED DATA STRUCTURES
// ------------------------------------------------------------

interface Sprite {
    image: HTMLImageElement;
    ready: boolean;
    lit?: HTMLCanvasElement;
    red?: HTMLCanvasElement;
}

// ------------------------------------------------------------
// LIGHT SPRITE
// ------------------------------------------------------------

/** Cached lighting overlay only; the original PNG and its silhouette stay intact. */
function lightSprite (
    image: HTMLImageElement,
    columns: number,
    rows: number,
    redCorner = false
): HTMLCanvasElement | undefined {
    if (typeof document === "undefined") return;

    const canvas = document.createElement("canvas");

    canvas.width = image.naturalWidth;

    canvas.height = image.naturalHeight;

    const c = canvas.getContext("2d");

    if (!c) return;

    c.drawImage(image, 0, 0);

    // Cached material pass preserves every source alpha and original atlas cell.
    const pixels = c.getImageData(0, 0, canvas.width, canvas.height);
    shadeLeather(pixels.data, canvas.width, redCorner);
    c.putImageData(pixels, 0, 0);

    // Source-atop confines light to existing opaque pixels, including each atlas cell.
    c.globalCompositeOperation = "source-atop";

    const w = canvas.width / columns,
        h = canvas.height / rows;

    for (let row = 0; row < rows; row++)
        for (let col = 0; col < columns; col++) {
            const x = col * w,
                y = row * h;

            const key = c.createLinearGradient(x, y, x + w, y + h * 0.35);

            key.addColorStop(0, "rgba(255,231,185,.23)");

            key.addColorStop(0.38, "rgba(255,219,161,.02)");

            key.addColorStop(0.65, "rgba(18,31,50,.04)");

            key.addColorStop(1, "rgba(12,24,34,.28)");

            c.fillStyle = key;

            c.fillRect(x, y, w, h);

            const bounce = c.createLinearGradient(x, y + h * 0.6, x, y + h);

            bounce.addColorStop(0, "rgba(104,160,182,0)");

            bounce.addColorStop(1, "rgba(122,177,192,.13)");

            c.fillStyle = bounce;

            c.fillRect(x, y, w, h);
        }

    c.globalCompositeOperation = "source-over";

    return canvas;
}

// ------------------------------------------------------------
// LOAD SPRITE
// ------------------------------------------------------------

function loadSprite (path: string, columns = 1, rows = 1): Sprite | undefined {
    // Simulation tests and server-side imports do not have a browser Image API.
    if (typeof Image === "undefined") return;

    const sprite: Sprite = { image: new Image(), ready: false };

    sprite.image.onload = () => {
        sprite.lit = lightSprite(sprite.image, columns, rows);

        sprite.red = lightSprite(sprite.image, columns, rows, true);

        sprite.ready = true;
    };

    sprite.image.src = path;

    return sprite;
}
const body = loadSprite("/art/opponent-body.png");
const arm = loadSprite("/art/first-person-arm.png");
const opponentArms = loadSprite("/art/opponent-arms.png", 4, 2);
const knocked = loadSprite("/art/boxer-knocked.png");
const blocking = loadSprite("/art/first-person-block.png");

// ------------------------------------------------------------
// REFERENCE BLOCK READY
// ------------------------------------------------------------

export function referenceBlockReady (): boolean {
    return blocking?.ready === true;
}

// ------------------------------------------------------------
// DRAW REFERENCE BLOCK
// ------------------------------------------------------------

/** Full guard overlay, kept low and bounded so the opponent remains visible. */
export function drawReferenceBlock (
    c: CanvasRenderingContext2D,
    amount: number,
    impact = 0,
    index = 1
): boolean {
    if (!blocking?.ready) return false;

    const guard = Math.max(0, Math.min(1, amount));

    const scale = Math.min(480 / blocking.image.naturalWidth, 330 / blocking.image.naturalHeight);

    const width = blocking.image.naturalWidth * scale,
        height = blocking.image.naturalHeight * scale;

    c.save();

    c.globalAlpha *= guard;

    c.translate(0, (1 - guard) * 90 + Math.max(0, Math.min(1, impact)) * 6);

    c.drawImage(
        (index === 0 ? blocking.red : blocking.lit) ?? blocking.image,
        500 - width / 2,
        580 - height,
        width,
        height
    );

    c.restore();

    return true;
}

// ------------------------------------------------------------
// DRAW REFERENCE KNOCKDOWN
// ------------------------------------------------------------

/** Dedicated knockdown art replaces the standing-body/procedural kneeling rig. */
export function drawReferenceKnockdown (
    c: CanvasRenderingContext2D,
    amount: number,
    response = 0,
    time = 0,
    index = 1
): boolean {
    if (!knocked?.ready) return false;

    const image = knocked.image,
        w = image.naturalWidth,
        h = image.naturalHeight;

    // The prepared cutout includes generous top padding. Crop to the character
    // before sizing it, so it stays grounded and proportionate to the standing rig.
    const height = 198,
        width = (height * (w * 0.75)) / (h * 0.73);

    const settle = Math.max(0, Math.min(1, amount)),
        effort = Math.max(0, Math.min(1, response));

    c.save();

    c.translate(0, -(1 - settle) * 8 - effort * 5 + Math.sin(time * 3) * settle);

    c.drawImage(
        (index === 0 ? knocked.red : knocked.lit) ?? image,
        w * 0.13,
        h * 0.17,
        w * 0.75,
        h * 0.73,
        -width / 2,
        -height,
        width,
        height
    );

    c.restore();

    return true;
}

// ------------------------------------------------------------
// DRAW REFERENCE BODY
// ------------------------------------------------------------

export function drawReferenceBody (
    c: CanvasRenderingContext2D,
    duck: number,
    bob = 0,
    step = 0,
    sway = 0,
    twist = 0,
    index = 1
): boolean {
    if (!body?.ready) return false;

    const w = body.image.naturalWidth,
        h = body.image.naturalHeight;

    // The source has transparent padding below its soles. Map the actual soles
    // to floor Y=0, then animate the torso independently of the planted legs.
    const split = 0.58,
        sole = 0.936,
        top = -sole * 292;

    const hip = top + split * 292,
        offset = bob + duck * 0.65;

    c.save();

    c.translate(sway, hip + offset);

    c.rotate(twist);

    c.translate(0, -hip);

    c.drawImage(
        (index === 0 ? body.red : body.lit) ?? body.image,
        0,
        0,
        w,
        h * split,
        -120,
        top,
        240,
        292 * split
    );

    c.restore();

    for (const side of [-1, 1]) {
        const rock = Math.max(0, side * step) * 0.008;

        const toe = side * 69;

        c.save();

        c.translate(toe, 0);

        c.rotate(side * rock);

        c.translate(-toe, 0);

        // Shear the knees with the weight shift; the bottom edge stays on the floor.
        c.transform(1, 0, sway / hip, (hip + offset) / hip, 0, 0);

        c.drawImage(
            (index === 0 ? body.red : body.lit) ?? body.image,
            side < 0 ? 0 : w / 2,
            h * split,
            w / 2,
            h * (sole - split),
            side < 0 ? -120 : 0,
            hip,
            120,
            -hip
        );

        c.restore();
    }

    return true;
}

// ------------------------------------------------------------
// DRAW REFERENCE ARM
// ------------------------------------------------------------

/** A separately rigged bitmap arm retains the reference's actual pixel shading. */
export function drawReferenceArm (
    c: CanvasRenderingContext2D,
    hand: [number, number],
    origin: [number, number],
    flip: boolean,
    index = 1
): boolean {
    if (!arm?.ready) return false;

    const w = arm.image.naturalWidth,
        h = arm.image.naturalHeight;

    const sourceHand = [w * 0.63, h * 0.26],
        sourceBase = [w * 0.27, h * 0.91];

    const sx = sourceHand[0] - sourceBase[0],
        sy = sourceHand[1] - sourceBase[1];

    const dx = hand[0] - origin[0],
        dy = hand[1] - origin[1];

    // Glove size is independent of reach: extending a punch must not balloon
    // the whole arm over the screen. The sprite's sleeve can exit the viewport.
    const scale = 196 / arm.image.naturalHeight;

    const sourceAngle = Math.atan2(sy, flip ? -sx : sx);

    c.save();

    c.shadowColor = "#08132166";

    c.shadowBlur = 4;

    c.shadowOffsetX = 3;

    c.shadowOffsetY = 4;

    c.translate(hand[0], hand[1]);

    c.rotate(Math.atan2(dy, dx) - sourceAngle);

    c.scale(flip ? -scale : scale, scale);

    c.drawImage((index === 0 ? arm.red : arm.lit) ?? arm.image, -sourceHand[0], -sourceHand[1]);

    c.restore();

    return true;
}

// ------------------------------------------------------------
// DRAW OPPONENT ARM
// ------------------------------------------------------------

/** Four supplied poses per side: guard, extending, contact, returning. */
export function drawOpponentArm (
    c: CanvasRenderingContext2D,
    side: number,
    hand: [number, number],
    reach: number,
    returning: boolean,
    index = 1
): boolean {
    if (!opponentArms?.ready) return false;

    const w = opponentArms.image.naturalWidth / 4,
        h = opponentArms.image.naturalHeight / 2;

    const phase = returning ? 2 + (1 - reach) * 2 : reach * 2;

    const frame = Math.floor(Math.min(3.999, phase)),
        blend = phase - frame;

    const next = frame === 3 ? 0 : frame + 1;

    const size = (78 + reach * 18) * 1.15;

    // Position entire arm relative to the moving fist, with the elbow below it.
    // Cell gutters are retained to avoid clipping the supplied silhouettes.
    const alpha = c.globalAlpha;

    c.save();

    c.shadowColor = "#08132166";

    c.shadowBlur = 3;

    c.shadowOffsetX = 2;

    c.shadowOffsetY = 3;

    c.translate(hand[0], hand[1] + 12);

    const draw = (column: number, opacity: number) => {
        c.globalAlpha = alpha * opacity;

        c.drawImage(
            (index === 0 ? opponentArms.red : opponentArms.lit) ?? opponentArms.image,
            column * w,
            side < 0 ? 0 : h,
            w,
            h,
            -size * 0.5,
            -size * 0.5,
            size,
            size
        );
    };

    draw(frame, 1 - blend);

    if (blend > 0) draw(next, blend);

    c.restore();

    return true;
}

// ------------------------------------------------------------
// DRAW REFERENCE GLOVE
// ------------------------------------------------------------

export function drawReferenceGlove (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    flip: boolean,
    index = 1
): boolean {
    if (!arm?.ready) return false;

    const w = arm.image.naturalWidth,
        h = arm.image.naturalHeight;

    c.save();

    c.shadowColor = "#08132155";

    c.shadowBlur = 3;

    c.shadowOffsetX = 2;

    c.shadowOffsetY = 3;

    c.translate(x, y);

    c.scale(flip ? -1 : 1, 1);

    c.drawImage(
        (index === 0 ? arm.red : arm.lit) ?? arm.image,
        w * 0.4,
        h * 0.07,
        w * 0.5,
        h * 0.42,
        -size * 0.55,
        -size * 0.55,
        size * 1.1,
        size * 1.1
    );

    c.restore();

    return true;
}

// ------------------------------------------------------------
// DRAW REFERENCE UPPER BODY
// ------------------------------------------------------------

/** Upper-body crop for the kneeling rig; legs are posed independently. */
export function drawReferenceUpperBody (c: CanvasRenderingContext2D, index = 1): boolean {
    if (!body?.ready) return false;

    c.drawImage(
        (index === 0 ? body.red : body.lit) ?? body.image,
        0,
        0,
        body.image.naturalWidth,
        body.image.naturalHeight * 0.58,
        -120,
        -273.312,
        240,
        169.36
    );

    return true;
}
