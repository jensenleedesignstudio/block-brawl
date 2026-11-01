// ============================================================
// CHARACTER MOTION AND ARENA DRAWING
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { impactRecoil } from "./presentation.js";
import { artworkStatus } from "./artwork-loading.js";
import { prepareGymArtwork } from "./gym-photography.js";
import { punchExtension, ultimatePose, ultimateHands } from "./punch-motion.js";
import {
    drawBoot,
    drawTrousers,
    drawTorso,
    drawFace,
    drawArm,
    drawGlove,
    fighterPalette
} from "./character-art.js";
import {
    drawReferenceBlock,
    referenceBlockReady,
    drawReferenceKnockdown,
    drawReferenceUpperBody,
    drawReferenceBody,
    drawReferenceArm,
    drawReferenceGlove,
    drawOpponentArm
} from "./reference-sprites.js";
import { arenaCamera, drawWorld, projectPoint } from "./arena-world.js";
import { ATTACKS, ringPositions, isAttack, type Fighter, type Match } from "../../shared/combat.js";

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

const W = 1000,
    H = 580;

// ------------------------------------------------------------
// DRAW A CONNECTED PIXEL ART LINE
// ------------------------------------------------------------

function line (c: CanvasRenderingContext2D, points: number[][], color: string, width: number) {
    c.strokeStyle = color;

    c.lineWidth = width;

    c.lineCap = "square";

    c.lineJoin = "bevel";

    c.beginPath();

    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));

    c.stroke();
}
const ease = (n: number) => {
    const t = Math.max(0, Math.min(1, n));

    return t * t * (3 - 2 * t);
};
const motionPhase = (age: number, duration: number) =>
    Math.min(ease(age / 5), ease((duration - age) / 7));

// ------------------------------------------------------------
// DRAW AN OVAL SHAPE
// ------------------------------------------------------------

function ellipse (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    rx: number,
    ry: number,
    color: string
) {
    c.fillStyle = color;

    c.beginPath();

    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);

    c.fill();
}

// ------------------------------------------------------------
// CALCULATE SHOULDER TURN, WINDUP, AND RECOIL
// ------------------------------------------------------------

function bodyMotion (f: Fighter) {
    let twist = 0,
        load = 0,
        drive = 0;

    if (isAttack(f.action)) {
        const contact = ATTACKS[f.action].startup;

        load = ease(f.age / Math.max(1, contact - 3)) * (1 - ease((f.age - contact + 3) / 3));

        drive = punchExtension(f.action, f.age);

        twist = (f.action === "jab" ? -1 : 1) * (drive * 0.18 - load * 0.1);

        if (f.action === "ultimate") {
            const u = ultimatePose(f.age);

            load = u.wind;

            drive = u.upper;

            twist = (u.right - u.left) * 0.09;
        }
    }

    const recoil = f.action === "hurt" ? Math.sin(Math.min(1, f.age / 14) * Math.PI) : 0;

    return { twist, load, drive, recoil };
}

// ------------------------------------------------------------
// DRAW FADING MOTION BEHIND A MOVING GLOVE
// ------------------------------------------------------------

function gloveTrail (
    c: CanvasRenderingContext2D,
    from: number[],
    to: number[],
    color: string,
    strength: number
) {
    if (strength < 0.08) return;

    c.save();

    for (let i = 3; i > 0; i--) {
        const t = i / 4;

        c.globalAlpha = strength * (1 - t) * 0.25;

        ellipse(
            c,
            to[0] + (from[0] - to[0]) * t,
            to[1] + (from[1] - to[1]) * t,
            22 + 12 * (1 - t),
            20 + 12 * (1 - t),
            color
        );
    }

    c.globalAlpha = strength * 0.45;

    for (const offset of [-12, 12])
        line(
            c,
            [
                [from[0] + offset, from[1]],
                [to[0] + offset, to[1]]
            ],
            color,
            2
        );

    c.restore();
}

// ------------------------------------------------------------
// DRAW THE KNOCKDOWN AND GET-UP POSE
// ------------------------------------------------------------

function kneelingFighter (
    c: CanvasRenderingContext2D,
    index: number,
    time: number,
    amount: number,
    response = 0
) {
    if (drawReferenceKnockdown(c, amount, response, time, index)) return;

    const palette = fighterPalette(index),
        settle = amount * 82,
        breath = Math.sin(time * 3) * 2 * amount;

    for (const side of [-1, 1]) {
        const hip: [number, number] = [side * 22, -108 + settle];

        const knee: [number, number] =
            side < 0 ? [-44, -52 + amount * 42] : [48, -53 + amount * 18];

        const ankle: [number, number] =
            side < 0 ? [-37 + amount * 45, -15] : [45 + amount * 16, -15];

        line(c, [hip, knee, ankle], "#252331", 35);

        line(c, [hip, knee, ankle], palette.pants, 27);

        line(
            c,
            [
                [hip[0] - 5, hip[1]],
                [knee[0] - 5, knee[1]],
                [ankle[0] - 5, ankle[1]]
            ],
            "#8a9b6c",
            5
        );

        for (let k = 0; k < 3; k++) {
            c.fillStyle = "#304e40";

            c.fillRect(knee[0] - 10, knee[1] - 8 + k * 5, 17 - k * 3, 3);
        }

        drawBoot(c, ankle[0], ankle[1], side < 0);
    }

    c.save();

    c.translate(0, settle + breath);

    c.translate(0, -110);

    c.rotate(0.12 * amount);

    c.translate(0, 110);

    if (!drawReferenceUpperBody(c, index)) {
        drawTorso(c, index);

        drawFace(c, true, index);
    }

    const hands: [number, number][] = [
        [-43, -174 + amount * 74],
        [43, -176 + amount * 48]
    ];

    hands.forEach((hand, i) => {
        hand[1] -= response * 18;

        const side = i === 0 ? -1 : 1;

        drawArm(c, [side * 42, -170], [side * 58, -132 + amount * 25], hand, 0, index);

        if (!drawReferenceGlove(c, hand[0], hand[1], 67, i === 1, index))
            drawGlove(c, hand[0], hand[1], 1.18, index, i === 1);
    });

    c.restore();
}

// ------------------------------------------------------------
// DRAW THE OPPONENT AND APPLY THE CURRENT BODY POSE
// ------------------------------------------------------------

function fighter (
    c: CanvasRenderingContext2D,
    f: Fighter,
    index: number,
    time: number,
    preview: boolean,
    fall = 0,
    rise = 0,
    impact = 0
) {
    const color = fighterPalette(index).glove,
        motion = bodyMotion(f),
        rhythm = time * (preview ? 7 : 10) + index * 1.7;

    const breathing = Math.sin(time * 2.8 + index) * 1.5,
        bounce = (1 - Math.cos(rhythm)) * 0.5;

    const cycle = (((time * (preview ? 1.45 : 1.8) + index * 0.35) % 1) + 1) % 1,
        airborne = cycle < 0.68 ? Math.sin((cycle / 0.68) * Math.PI) : 0;

    const jump = f.hp <= 0 || fall || rise ? 0 : airborne * (isAttack(f.action) ? 2 : 4);

    const landing = f.hp <= 0 ? 0 : Math.max(0, 1 - Math.abs(cycle - 0.75) / 0.1) * 3,
        lift = f.hp <= 0 ? 0 : (preview ? 3 : 4) * bounce;

    const duck = f.action === "duck" ? 42 * motionPhase(f.age, 32) : 0;

    const lean =
        f.action === "dazed"
            ? Math.sin(time * 19) * 11
            : (f.action === "dodgeLeft" ? -42 : f.action === "dodgeRight" ? 42 : 0) *
                  motionPhase(f.age, 27) +
              (f.action === "hurt" ? -12 * ease(f.age / 5) : 0);

    c.save();

    c.translate(f.x, 432);

    // Warm light from upper-left casts a soft silhouette back across the pavement.
    c.save();

    c.translate(20, 8);

    c.rotate(0.14);

    ellipse(c, 12, 1, 88 - jump * 0.5, 16, "#07132212");

    ellipse(c, 7, 0, 74 - jump * 0.5, 12, "#0713221c");

    c.restore();

    ellipse(c, 0, 2, 79 - jump * 0.8, 14 - jump * 0.25, "#0003");

    ellipse(c, 0, 0, 61 - jump * 0.7, 9 - jump * 0.2, jump > 4 ? "#0003" : "#0006");

    // Two contact shadows keep the boots distinct from the cast shadow.
    const contact = jump > 4 ? "#09132318" : "#09132365";

    ellipse(c, -47, 1, 27, 4, contact);

    ellipse(c, 48, 1, 27, 4, contact);

    c.translate(0, -jump);

    if (fall || rise) {
        // Stagger, buckle, then settle into the existing kneeling artwork.
        const settle = fall || rise;

        c.translate(Math.sin(settle * Math.PI) * -24, -Math.sin(settle * Math.PI) * 12);

        c.rotate(-Math.sin(settle * Math.PI) * 0.18);

        const blend = ease(settle / 0.72);

        if (blend < 1) {
            c.save();

            c.globalAlpha *= 1 - blend;

            c.translate(-f.x, -432 + settle * 42);

            fighter(c, { ...f, action: "hurt", age: settle * 14 }, index, time, preview);

            c.restore();
        }

        c.globalAlpha *= blend;

        kneelingFighter(c, index, time, settle, impact);

        c.restore();

        return;
    }

    const step = Math.sin(rhythm) * 5 * (1 - motion.load) + motion.drive * 8;

    const bodyY = -lift + landing + motion.load * 10 - motion.drive * 8 + breathing + impact * 5,
        bodyX = lean - motion.recoil * 13 + motion.drive * 6;

    c.scale(1.22, 1);

    const bitmapBody = drawReferenceBody(c, duck, bodyY, step, bodyX, motion.twist * 0.65, index);

    if (!bitmapBody) {
        c.save();

        c.scale(1, 1 - duck / 150);

        drawTrousers(c, step, 0, index);

        c.restore();
    }

    c.translate(bodyX, duck + bodyY);

    c.translate(0, -110);

    c.rotate(
        motion.twist -
            motion.recoil * 0.08 +
            (f.action === "dodgeLeft" ? -0.13 : f.action === "dodgeRight" ? 0.13 : 0) *
                motionPhase(f.age, 27)
    );

    c.translate(0, 110);

    if (!bitmapBody) {
        drawTorso(c, index);

        drawFace(c, f.action === "hurt", index);
    }

    if (f.action === "dazed")
        for (let k = 0; k < 3; k++) {
            const a = f.age * 0.16 + (k * Math.PI * 2) / 3;

            c.fillStyle = "#ffe39b";

            c.fillRect(Math.cos(a) * 42 - 4, -270 + Math.sin(a) * 12, 8, 8);
        }

    const guardSway = Math.sin(time * 2.8 + index) * 1.5;

    let left: [number, number] = [-47, -190 + guardSway],
        right: [number, number] = [39, -181 - guardSway];

    let leftElbow: [number, number] = [-51, -148],
        rightElbow: [number, number] = [49, -141];

    let leftReach = 0,
        rightReach = 0;

    if (f.action === "block") {
        const guard = ease(f.age / 4);

        left = [-40 + 22 * guard, -185 - 33 * guard];

        right = [40 - 22 * guard, -185 - 33 * guard];

        leftElbow = [-43, -177];

        rightElbow = [43, -177];
    }

    if (isAttack(f.action)) {
        const extension = punchExtension(f.action, f.age);

        if (f.action === "jab") {
            right[1] -= extension * 15;

            left = [left[0] + extension * 40, left[1] + extension * 17];

            leftElbow = [-48 + extension * 20, -151 - extension * 19];

            leftReach = extension;
        }

        if (f.action === "cross") {
            left[1] -= extension * 17;

            right = [right[0] - extension * 33, right[1] + extension * 17];

            rightElbow = [48 - extension * 20, -151 - extension * 19];

            rightReach = extension;
        }

        if (f.action === "ultimate") {
            const u = ultimatePose(f.age);

            ({ left, right } = ultimateHands(f.age, false));

            rightElbow = [60 - u.right * 30, -135 - u.upper * 45];

            rightReach = u.upper * 1.25 + u.right * 0.65;

            leftElbow = [-48 + u.left * 20, -151 - u.left * 19];

            leftReach = u.left * 0.65;

            if (f.age < 40) {
                ellipse(c, right[0], right[1], 30 + u.upper * 25, 30 + u.upper * 25, "#ffe39b55");

                for (let k = 0; k < 5; k++)
                    line(
                        c,
                        [
                            [right[0] + k * 8 - 20, right[1] + 30],
                            [right[0] + k * 8 - 20, right[1] + 65 + u.upper * 30]
                        ],
                        "#ffe39b88",
                        3
                    );
            }
        }

        if (f.action === "hook") {
            left[1] -= extension * 20;

            right = [
                right[0] - extension * 70 + Math.sin(extension * Math.PI) * 32,
                right[1] - extension * 9 - Math.sin(extension * Math.PI) * 28
            ];

            rightElbow = [48 + extension * 30, -151 - extension * 41];

            rightReach = extension;
        }
    }

    if (f.action === "hurt") {
        left[0] -= motion.recoil * 15;

        right[0] += motion.recoil * 20;

        left[1] += motion.recoil * 28;

        right[1] += motion.recoil * 20;
    }

    if (f.action !== "ultimate") {
        left[0] -= motion.load * 8;

        right[0] += motion.load * 8;

        left[1] += motion.load * 6;

        right[1] += motion.load * 6;
    }

    gloveTrail(c, [-40, -185], left, color, leftReach);

    gloveTrail(c, [40, -185], right, color, rightReach);

    for (const [side, hand, elbow, reach] of [
        [-1, left, leftElbow, leftReach],
        [1, right, rightElbow, rightReach]
    ] as const) {
        if (
            drawOpponentArm(
                c,
                side,
                hand,
                reach,
                isAttack(f.action) && f.age > ATTACKS[f.action].startup,
                index
            )
        )
            continue;

        drawArm(c, [side * (bitmapBody ? 48 : 34), -170], elbow, hand, reach, index);

        c.save();

        c.translate(hand[0], hand[1]);

        c.rotate(side * (0.12 + reach * 0.18));

        if (!drawReferenceGlove(c, 0, 0, (58 + reach * 42) * 1.15, side > 0, index))
            drawGlove(c, 0, 0, (1.02 + reach * 0.72) * 1.15, index, side > 0);

        c.restore();
    }

    c.restore();
}

// ------------------------------------------------------------
// DRAW YOUR HANDS, GUARD, AND PUNCH FOLLOW-THROUGH
// ------------------------------------------------------------

function firstPersonGloves (
    c: CanvasRenderingContext2D,
    f: Fighter,
    index: number,
    time: number,
    impact = 0
) {
    if (f.action === "block" && referenceBlockReady()) {
        const guard = ease(f.age / 6);

        if (guard < 1) {
            c.save();

            c.globalAlpha *= 1 - guard;

            firstPersonGloves(c, { ...f, action: "idle" }, index, time, impact);

            c.restore();
        }

        drawReferenceBlock(c, guard, impact, index);

        return;
    }

    const glove = fighterPalette(index).glove,
        sleeve = fighterPalette(index).cloth,
        motion = bodyMotion(f),
        pulse = Math.sin(time * 9) * 5;

    let left: [number, number] = [325, 500 + pulse * 0.5],
        right: [number, number] = [675, 500 - pulse * 0.5];

    const sideShift =
        (f.action === "dodgeLeft" ? -28 : f.action === "dodgeRight" ? 28 : 0) *
        motionPhase(f.age, 27);

    left[0] += sideShift;

    right[0] += sideShift;

    if (f.action === "block") {
        const guard = ease(f.age / 4);

        left = [325 + 70 * guard, 500 - 100 * guard];

        right = [675 - 70 * guard, 500 - 100 * guard];
    }

    if (f.action === "duck") {
        left[1] += 34 * motionPhase(f.age, 32);

        right[1] += 34 * motionPhase(f.age, 32);
    }

    if (isAttack(f.action)) {
        const progress = punchExtension(f.action, f.age);

        if (f.action === "jab") {
            left = [left[0] + progress * 155, left[1] - progress * 160];

            right[1] -= progress * 48;

            right[0] -= progress * 14;
        }

        if (f.action === "cross") {
            right = [right[0] - progress * 155, right[1] - progress * 160];

            left[1] -= progress * 48;

            left[0] += progress * 14;
        }

        if (f.action === "ultimate") {
            ({ left, right } = ultimateHands(f.age, true));

            left = [left[0] - 70, left[1] + 93];

            right = [right[0] + 70, right[1] + 93];

            if (f.age < 40) {
                ellipse(c, right[0], right[1], 65, 65, "#ffe39b55");

                for (let k = 0; k < 6; k++)
                    line(
                        c,
                        [
                            [right[0] - 35 + k * 14, right[1] + 35],
                            [right[0] - 35 + k * 14, right[1] + 110]
                        ],
                        "#ffe39b99",
                        5
                    );
            }
        }

        if (f.action === "hook") {
            right = [
                right[0] - progress * 205 + Math.sin(progress * Math.PI) * 75,
                right[1] - progress * 130 - Math.sin(progress * Math.PI) * 42
            ];

            left[1] -= progress * 55;

            left[0] += progress * 20;
        }
    }

    if (f.action !== "ultimate") {
        left[0] -= motion.load * 12;

        right[0] += motion.load * 12;

        left[1] += motion.load * 14 + motion.recoil * 32;

        right[1] += motion.load * 14 + motion.recoil * 32;
    }

    if (isAttack(f.action)) {
        const u = f.action === "ultimate" ? ultimatePose(f.age) : null;

        gloveTrail(c, [325, 500], left, glove, u ? u.left : f.action === "jab" ? motion.drive : 0);

        gloveTrail(
            c,
            [675, 500 + (u ? u.wind * 75 : 0)],
            right,
            glove,
            u ? Math.max(u.upper, u.right) : f.action !== "jab" ? motion.drive : 0
        );
    }

    for (const [side, pos] of [
        [-1, left],
        [1, right]
    ] as const) {
        pos[1] += impact * 18;

        const [x, y] = pos,
            origin = side < 0 ? 245 : 755;

        if (drawReferenceArm(c, [x, y], [origin, 650], side > 0, index)) continue;

        c.save();

        c.translate(x, y);

        c.rotate(
            f.action === "ultimate"
                ? 0
                : side * (motion.load * 0.08 - motion.drive * 0.16) + motion.recoil * side * 0.13
        );

        c.translate(-x, -y);

        line(
            c,
            [
                [origin, 590],
                [origin + side * 25, 505],
                [x, y + 24]
            ],
            "#252331",
            79
        );

        line(
            c,
            [
                [origin, 590],
                [origin + side * 25, 505],
                [x, y + 24]
            ],
            sleeve,
            65
        );

        line(
            c,
            [
                [origin + side * 25, 505],
                [x, y + 24]
            ],
            "#709f8e",
            42
        );

        line(
            c,
            [
                [origin + side * 25, 505],
                [x, y + 24]
            ],
            "#c58a5b",
            32
        );

        line(
            c,
            [
                [origin + side * 25 - 7, 505],
                [x - 7, y + 24]
            ],
            "#edb57e",
            10
        );

        drawGlove(c, x, y, 2.07, index, side > 0);

        c.restore();
    }
}

// ------------------------------------------------------------
// DRAW THE WORLD, FIGHTERS, AND COMBAT EFFECTS
// ------------------------------------------------------------

export function renderArena (
    c: CanvasRenderingContext2D,
    m: Match,
    time: number,
    preview = false,
    viewIndex: 0 | 1 = 0,
    frameFraction = 0,
    reducedMotion = false
) {
    const ratio = c.canvas.width / W;

    c.setTransform(ratio, 0, 0, ratio, 0, 0);

    c.imageSmoothingEnabled = false;

    c.clearRect(0, 0, W, H);

    prepareGymArtwork();
    if (artworkStatus() !== "ready") {
        c.fillStyle = "#14251f";
        c.fillRect(0, 0, W, H);
        return;
    }

    // Render fractional action ages between simulation ticks. Combat and hit
    // timing stay authoritative; hitstop deliberately freezes these poses.
    const fraction =
        m.hitstop > 0 || m.phase !== "fight" ? 0 : Math.max(0, Math.min(2, frameFraction));

    const self = { ...m.fighters[viewIndex], age: m.fighters[viewIndex].age + fraction };

    const opponent = {
        ...m.fighters[1 - viewIndex],
        age: m.fighters[1 - viewIndex].age + fraction
    };

    const scene = preview
        ? {
              ...m,
              orbit: time * 0.18,
              fighters: [
                  { ...m.fighters[0], x: 432.5 },
                  { ...m.fighters[1], x: 567.5 }
              ] as Match["fighters"]
          }
        : m;

    const positions = ringPositions(scene),
        camera = arenaCamera(scene, viewIndex);

    const target = projectPoint(camera, { ...positions[1 - viewIndex], z: 0 });

    const scale = target.scale * 0.65;

    const cameraShift =
        (self.action === "dodgeLeft" ? 65 : self.action === "dodgeRight" ? -65 : 0) *
        motionPhase(self.age, 27);

    const cameraDrop = self.action === "duck" ? -42 * motionPhase(self.age, 32) : 0;

    const fall =
        m.phase === "knockdown"
            ? ease((600 - m.recoveryTicks) / 22)
            : m.phase === "finished"
              ? 1
              : 0;

    const rise =
        m.phase === "countdown" && m.countdown <= 60 ? 1 - ease((60 - m.countdown) / 40) : 0;

    const recoveryPulse =
        m.phase === "knockdown" && m.recovery > 0
            ? Math.max(0, 1 - (m.tick - m.recoveryLastTick) / 10)
            : 0;

    const impactFor = (index: number) =>
        Math.max(
            0,
            ...m.events
                .filter((e) => e.target === index && e.kind !== "miss" && m.tick - e.tick < 10)
                .map((e) => Math.sin(((m.tick - e.tick) / 10) * Math.PI))
        );

    const hurt = m.events.some(
        (e) => e.target === viewIndex && e.kind === "hit" && m.tick - e.tick < 12
    );

    c.fillStyle = "#10253c";

    c.fillRect(0, 0, W, H);

    const lastHit = m.events.filter((e) => e.target === viewIndex && e.kind === "hit").at(-1);

    const recoil = lastHit && !reducedMotion ? impactRecoil(m.tick - lastHit.tick) : { x: 0, y: 0 };

    const finisher = [self, opponent].find((f) => f.action === "ultimate");

    const cinema = finisher && !reducedMotion ? motionPhase(finisher.age, 84) : 0;

    const zoom = 1 + cinema * 0.035;

    const dropAge = m.phase === "knockdown" ? 600 - m.recoveryTicks : 999;

    const dropKick =
        !reducedMotion && dropAge < 30
            ? Math.sin(dropAge * 0.8) * Math.pow(1 - dropAge / 30, 2) * 9
            : 0;

    c.save();

    c.translate(500, 300);

    c.scale(zoom, zoom);

    c.translate(-500, -300);

    c.translate(cameraShift + recoil.x, cameraDrop + recoil.y + dropKick);

    drawWorld(c, camera);

    // Sparse, deterministic gym dust catches the warm window light.
    // Driven by presentation time so pause and reduced-motion freeze it naturally.
    c.save();

    for (let k = 0; k < 18; k++) {
        const drift = time * (5 + (k % 4)),
            x =
                ((((k * 137.3 + Math.sin(time * 0.24 + k) * 18 + drift * 0.35) % 1040) + 1040) %
                    1040) -
                20;

        const y = 120 + ((((k * 71.7 - drift) % 420) + 420) % 420);

        c.globalAlpha = 0.08 + (Math.sin(time * 0.8 + k * 1.7) + 1) * 0.055;

        c.fillStyle = k % 3 === 0 ? "#ffdf9b" : "#a9d5e5";

        c.fillRect(Math.round(x), Math.round(y), k % 4 === 0 ? 3 : 2, 2);
    }

    c.restore();

    c.save();

    c.translate(target.x, target.y - 432 * scale);

    c.scale(scale, scale);

    const projected = { ...opponent, x: opponent.hp <= 0 ? -100 : 0 };

    if (self.hp > 0)
        fighter(
            c,
            projected,
            1 - viewIndex,
            time,
            preview,
            opponent.hp <= 0 ? fall : 0,
            opponent.knockdowns > 0 && opponent.hp === 60 ? rise : 0,
            opponent.hp <= 0 ? recoveryPulse : impactFor(1 - viewIndex)
        );

    c.restore();

    c.restore();

    for (const e of m.events) {
        const age = m.tick - e.tick;

        if (age > 32) continue;

        if (e.kind === "parry" && e.target === viewIndex) {
            c.save();

            c.globalAlpha = 1 - age / 32;

            c.textAlign = "center";

            c.font = 'bold 20px "Press Start 2P", monospace';

            c.fillStyle = "#e7c1ff";

            c.fillText("PERFECT BLOCK!", 500, 270 - age * 0.8);

            c.restore();

            continue;
        }

        if (e.kind !== "miss" && age < 22) {
            c.save();

            const x = e.target === viewIndex ? 500 : target.x,
                y = e.target === viewIndex ? 350 : target.y - 160 * scale;

            const tint = e.kind === "hit" ? "#ffdd83" : "#9eeaff";

            c.globalAlpha = (1 - age / 22) * 0.85;

            c.strokeStyle = tint;

            c.lineWidth = Math.max(1, 5 - age * 0.2);

            c.beginPath();

            c.ellipse(x, y, 12 + age * 4, 8 + age * 2.5, 0, 0, Math.PI * 2);

            c.stroke();

            for (let k = 0; k < 12; k++) {
                const a = k * 2.399 + e.id,
                    v = 2 + (k % 4);

                c.fillStyle = k % 3 === 0 ? "#ffffff" : tint;

                const size = Math.max(2, 7 - age * 0.2);

                const px = x + Math.cos(a) * age * v,
                    py = y + Math.sin(a) * age * v + age * age * 0.09;
                line(
                    c,
                    [
                        [px, py],
                        [px - Math.cos(a) * size * 1.8, py - Math.sin(a) * size * 1.8]
                    ],
                    k % 3 === 0 ? "#fff8df" : tint,
                    Math.max(1, size * 0.42)
                );
            }

            c.restore();
        }

        if (e.target !== 1 - viewIndex) continue;

        c.save();

        c.globalAlpha = 1 - age / 32;

        if (e.kind !== "miss")
            for (let k = 0; k < 9; k++) {
                const angle = k * 2.4 + e.id,
                    r = 24 + age * 2;

                line(
                    c,
                    [
                        [500 + Math.cos(angle) * r, 260 + Math.sin(angle) * r],
                        [500 + Math.cos(angle) * (r + 11), 260 + Math.sin(angle) * (r + 11)]
                    ],
                    e.kind === "block" || e.kind === "parry" ? "#d3b3ff" : "#ffdb8a",
                    5
                );
            }

        c.font = 'bold 17px "Press Start 2P", monospace';

        c.fillStyle =
            e.kind === "miss"
                ? "#e5d3ef"
                : e.kind === "block" || e.kind === "parry"
                  ? "#d5b4ff"
                  : "#ffe396";

        c.fillText(
            e.kind === "miss"
                ? "MISS"
                : e.kind === "parry"
                  ? "PARRIED!"
                  : e.kind === "block"
                    ? "BLOCK"
                    : `−${e.damage}`,
            500,
            184 - age * 1.2
        );

        c.restore();
    }

    const powering =
        self.action === "ultimate" ? self : opponent.action === "ultimate" ? opponent : null;

    if (powering) {
        // Gold energy coils into the uppercut, then opens into the follow-up strikes.
        const u = ultimatePose(powering.age),
            strength = motionPhase(powering.age, 84);

        c.save();

        c.globalAlpha = strength * (reducedMotion ? 0.12 : 0.32);

        c.fillStyle = "#060f27";

        c.fillRect(0, 0, W, H);

        if (!reducedMotion) {
            c.globalAlpha = strength * 0.55;

            for (let k = 0; k < 3; k++) {
                const radius = 75 + k * 38 + u.upper * 95;

                c.strokeStyle = k === 1 ? "#e7fbff" : "#ffca58";

                c.lineWidth = 3 - k * 0.6;

                c.beginPath();

                c.ellipse(
                    500,
                    340,
                    radius,
                    radius * 0.36,
                    powering.age * 0.04 + k,
                    0,
                    Math.PI * 1.5
                );

                c.stroke();
            }

            const burst = Math.max(0, 1 - Math.abs(powering.age - 28) / 7);

            c.globalAlpha = burst * 0.22;

            c.fillStyle = "#ffe3a0";

            c.fillRect(0, 0, W, H);
        }

        c.restore();

        const wind = Math.min(1, powering.age / ATTACKS.ultimate.startup);

        c.save();

        c.globalAlpha = motionPhase(powering.age, 84) * 0.7;

        for (let k = 0; k < 16; k++) {
            const angle = (k * Math.PI) / 8 + powering.age * 0.025;

            const radius = 230 - wind * 45;

            line(
                c,
                [
                    [500 + Math.cos(angle) * radius, 300 + Math.sin(angle) * radius],
                    [500 + Math.cos(angle) * (radius + 65), 300 + Math.sin(angle) * (radius + 65)]
                ],
                "#ffe39b",
                3
            );
        }

        c.textAlign = "center";

        c.font = "bold 18px monospace";

        c.fillStyle = "#ffe39b";

        c.fillText(powering.age < 40 ? "RISING BREAKER" : "RAPID COMBO", 500, 145);

        c.restore();
    }

    c.save();

    if (self.hp <= 0) {
        // A temporary third-person recovery view makes your own kneeling pose visible.
        c.translate(0, 50);

        fighter(
            c,
            { ...self, x: 340 },
            viewIndex,
            time,
            false,
            Math.max(0.01, fall),
            0,
            recoveryPulse
        );

        c.fillStyle = "#eee4ca";

        c.font = "bold 15px monospace";

        c.textAlign = "center";

        if (m.phase === "knockdown") c.fillText("YOU · GET BACK UP", 340, 462);
    } else if (m.phase !== "knockdown" && m.phase !== "finished") {
        if (self.knockdowns > 0 && self.hp === 60 && rise) c.translate(0, 145 * rise);

        firstPersonGloves(c, self, viewIndex, time, impactFor(viewIndex));
    }

    c.restore();

    if (m.phase === "knockdown" && !reducedMotion && dropAge < 45) {
        const p = dropAge / 45;

        c.save();

        c.globalAlpha = (1 - p) * 0.65;

        c.strokeStyle = "#ffd688";

        c.lineWidth = 4 * (1 - p) + 1;

        c.beginPath();

        c.ellipse(
            m.down === viewIndex ? 340 : target.x,
            Math.min(540, target.y),
            40 + p * 260,
            10 + p * 60,
            0,
            0,
            Math.PI * 2
        );

        c.stroke();

        for (let k = 0; k < 14; k++) {
            const angle = k * 2.4,
                r = p * (80 + k * 7);

            c.fillStyle = k % 3 ? "#d6bd8f" : "#fff1cd";

            c.fillRect(
                (m.down === viewIndex ? 340 : target.x) + Math.cos(angle) * r,
                Math.min(540, target.y) + Math.sin(angle) * r * 0.24 - p * (1 - p) * 85,
                4,
                4
            );
        }

        c.restore();
    }

    if (hurt) {
        c.fillStyle = "#ff695022";

        c.fillRect(0, 0, W, H);
    }
}
