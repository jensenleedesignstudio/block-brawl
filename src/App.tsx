// ============================================================
// GAME SETUP, MATCH FLOW, AND ARCADE SCREENS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { useModalFocus } from "./hooks/useModalFocus";
import { FightMenu } from "./components/FightMenu";
import { PixelIcon } from "./components/PixelIcon";
import { PixelBackdrop } from "./components/PixelBackdrop";
import { ArcadeSettings } from "./components/ArcadeSettings";
import { ChallengerCard } from "./components/ChallengerCard";
import { MoveLibrary } from "./components/MoveLibrary";
import { CircuitRoster } from "./components/CircuitRoster";
import { RoundHistory, type RoundRecord } from "./components/RoundHistory";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { loadSocketClient } from "./network";
import { modelServiceUrl } from "./model-service";
import { CONNECTING_MODEL, monitorModelHealth, type ModelHealth } from "./model-health";
import { isPartyCode, normalizePartyCode, partyCodeFromUrl, partyInviteUrl } from "./party";
import {
    act,
    ROUND_SECONDS,
    createMatch,
    move,
    setInputMode,
    type Action,
    type Difficulty,
    type Match,
    type Movement
} from "../shared/combat";
import type { Bot } from "../shared/ai";
import { LearnedBot } from "../shared/learned-ai";
import { Arena } from "./components/Arena";
import { MotionCamera } from "./components/MotionCamera";
import { PartyCameras } from "./components/PartyCameras";
import { BoxerArt, commandPose } from "./components/BoxerArt";
import { unlockAudio, setMusicEnabled, disposeMusic } from "./game/audio";
import "./fight-view.css";
import "./boxer-art.css";
import "./training-ui.css";

// ------------------------------------------------------------
// TYPES AND SHARED DATA STRUCTURES
// ------------------------------------------------------------

interface Room {
    code: string;
    players: { name: string; ready: boolean; connected: boolean }[];
    paused: boolean;
    match: Match | null;
}

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

const keymap: Record<string, Action> = {
    r: "ultimate",
    j: "jab",
    k: "cross",
    l: "hook",
    " ": "block",
    a: "dodgeLeft",
    d: "dodgeRight",
    s: "duck"
};
const modelUrl = modelServiceUrl(window.location.href, import.meta.env.VITE_MODEL_URL);
const controls = [
    [
        "R",
        "Ultimate",
        "Fill the meter, then rapidly raise ONE hand above your head whether or not the elbow is visible. Keep the other hand lower; lower both hands to reset. R or UNLEASH also works. Rising Breaker lands an 18-damage uppercut and three 2-damage combo hits."
    ],
    ["J", "Jab", "Straighten your left arm through shoulder, elbow, and hand; return to guard."],
    ["K", "Cross", "Straighten your right arm through shoulder, elbow, and hand; return to guard."],
    [
        "L",
        "Right hook",
        "Quickly sweep your right fist horizontally inward across your chest with a bent elbow, then return it to guard. Keyboard: L."
    ],
    [
        "SPACE",
        "Block",
        "Raise your guard just before impact to daze the attacker. Holding it drains the guard bar."
    ],
    ["A / D", "Dodge", "Move your head and shoulders left or right together."],
    ["S", "Duck", "Drop your head by bending your knees."]
];

// ------------------------------------------------------------
// GAME STATE, EVENT HANDLERS, AND PAGE LAYOUT
// ------------------------------------------------------------

export default function App () {
    // ------------------------------------------------------------
    // PLAYER CHOICES AND MATCH STATE
    // ------------------------------------------------------------

    const [playbookOpen, setPlaybookOpen] = useState(() =>
        ["#moves", "#fighters", "#rounds"].includes(window.location.hash)
    );

    const [cornerOpen, setCornerOpen] = useState(true);
    const [toolTab, setToolTab] = useState<"fighters" | "moves" | "rounds">(
        window.location.hash === "#fighters"
            ? "fighters"
            : window.location.hash === "#rounds"
              ? "rounds"
              : "moves"
    );

    useEffect(() => {
        const syncTools = () => {
            const tab = window.location.hash.slice(1);
            if (tab === "moves" || tab === "fighters" || tab === "rounds") {
                setToolTab(tab);
                setPlaybookOpen(true);
            } else if (tab === "arcade" || !tab) setPlaybookOpen(false);
        };
        window.addEventListener("hashchange", syncTools);
        return () => window.removeEventListener("hashchange", syncTools);
    }, []);

    const [mode, setMode] = useState<"ai" | "online">(() =>
            partyCodeFromUrl(window.location.href) ? "online" : "ai"
        ),
        [difficulty, setDifficulty] = useState<Difficulty>("medium"),
        [input, setInput] = useState<"keyboard" | "motion">("keyboard");

    const [playing, setPlaying] = useState(false),
        [finished, setFinished] = useState(false),
        [paused, setPaused] = useState(false),
        [help, setHelp] = useState(false),
        [muted, setMuted] = useState(false);

    // Presentation only: clear the ring at match start, restore setup on leaving.
    useEffect(() => {
        setCornerOpen(!playing);
    }, [playing]);

    const [motionStream, setMotionStream] = useState<MediaStream | null>(null);
    const [cameraReady, setCameraReady] = useState(false),
        [room, setRoom] = useState<Room | null>(null),
        [code, setCode] = useState(() => partyCodeFromUrl(window.location.href)),
        [name, setName] = useState("YOU"),
        [connection, setConnection] = useState("offline"),
        [connectionAttempt, setConnectionAttempt] = useState(0),
        [error, setError] = useState(""),
        [copied, setCopied] = useState(false),
        [inviteCopied, setInviteCopied] = useState(false),
        [wins, setWins] = useState(0);

    const matchRef = useRef(createMatch()),
        botRef = useRef<Bot | null>(null),
        socket = useRef<Socket | null>(null),
        playerIndex = useRef(0),
        session = useRef<{ code: string; token: string } | null>(null);

    const resultShown = useRef(false),
        finishRef = useRef<() => void>(() => {});

    const [fightMenu, setFightMenu] = useState(false);

    const [immersive, setImmersive] = useState(false),
        [fullscreenHint, setFullscreenHint] = useState(false);

    const [settings, setSettings] = useState(false),
        [autoFullscreen, setAutoFullscreen] = useState(true),
        [scanlines, setScanlines] = useState(true);

    const [rounds, setRounds] = useState<RoundRecord[]>([]);

    // ------------------------------------------------------------
    // TRAINED OPPONENT STATUS
    // ------------------------------------------------------------

    const [modelStatus, setModelStatus] = useState("connecting");
    const [modelHealth, setModelHealth] = useState<ModelHealth>(CONNECTING_MODEL);
    const modelReady = modelHealth.kind === "ready";

    useEffect(() => {
        if (mode !== "ai") return;
        if (!modelUrl) return;
        return monitorModelHealth(modelUrl, setModelHealth);
    }, [mode]);

    useEffect(() => {
        if (!playing || mode !== "ai") return;

        const timer = window.setInterval(() => {
            const bot = botRef.current;

            if (bot instanceof LearnedBot) setModelStatus(bot.status);
        }, 500);

        return () => window.clearInterval(timer);
    }, [playing, mode]);

    // ------------------------------------------------------------
    // DIALOG FOCUS AND START GESTURE
    // ------------------------------------------------------------

    const closeHelp = useCallback(() => setHelp(false), []);

    useModalFocus(help, closeHelp);

    useModalFocus(finished);

    const gloveStartPending = useRef(false);

    // ------------------------------------------------------------
    // ENTER AND LEAVE THE FULLSCREEN FIGHT VIEW
    // ------------------------------------------------------------

    const enterFullscreen = () => {
        setImmersive(true);

        if (document.fullscreenElement) return;

        try {
            const request = document.documentElement.requestFullscreen?.();

            if (request)
                void request
                    .then(() => setFullscreenHint(false))
                    .catch(() => setFullscreenHint(true));
            else setFullscreenHint(true);
        } catch {
            setFullscreenHint(true);
        }
    };

    const exitFightView = () => {
        setImmersive(false);

        setFullscreenHint(false);

        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };

    useEffect(() => {
        const changed = () => {
            if (!document.fullscreenElement) {
                setImmersive(false);

                setFullscreenHint(false);
            }
        };

        document.addEventListener("fullscreenchange", changed);

        return () => document.removeEventListener("fullscreenchange", changed);
    }, []);

    useEffect(() => {
        if (playing && gloveStartPending.current) {
            gloveStartPending.current = false;

            if (autoFullscreen) {
                setImmersive(true);

                setFullscreenHint(!document.fullscreenElement);
            }
        }
    }, [playing, autoFullscreen]);

    // ------------------------------------------------------------
    // LIVE INPUT STATE AND ACTION DISPATCH
    // ------------------------------------------------------------

    const state = useRef({
        playing,
        mode,
        input,
        paused,
        dialogOpen: help || settings || fightMenu || playbookOpen || finished
    });

    state.current = {
        playing,
        mode,
        input,
        paused,
        dialogOpen: help || settings || fightMenu || playbookOpen || finished
    };

    const send = useCallback((action: Action, held = true) => {
        const s = state.current;

        if (!s.playing) return;

        // Releases must still reach the match after an overlay opens or focus is lost.
        if ((s.paused || s.dialogOpen) && !(action === "block" && !held)) return;

        if (s.mode === "online") socket.current?.emit("action", { action, held });
        else act(matchRef.current, 0, action, held);
    }, []);

    const sendMove = useCallback((direction: Movement) => {
        const s = state.current;

        if (!s.playing) return;

        if ((s.paused || s.dialogOpen) && direction !== 0) return;

        if (s.mode === "online") socket.current?.emit("movement", direction);
        else move(matchRef.current, 0, direction);
    }, []);

    useEffect(() => {
        if (playbookOpen) {
            send("block", false);
            sendMove(0);
        }
    }, [playbookOpen, send, sendMove]);

    // ------------------------------------------------------------
    // KEYBOARD CONTROLS AND WINDOW FOCUS
    // ------------------------------------------------------------

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (
                state.current.dialogOpen ||
                (e.target as HTMLElement).matches("input,textarea,select")
            )
                return;

            if (e.key === "Escape" && state.current.playing) {
                send("block", false);

                sendMove(0);

                setFightMenu(true);

                if (state.current.mode === "ai") setPaused(true);

                return;
            }

            const a = keymap[e.key.toLowerCase()];

            if (!a || !state.current.playing) return;

            e.preventDefault();

            if (!e.repeat) {
                if (a !== "block") send("block", false);

                send(a);
            }
        };

        const up = (e: KeyboardEvent) => {
            if (e.key === " ") send("block", false);
        };

        const blur = () => {
            send("block", false);

            sendMove(0);

            if (state.current.playing && state.current.mode === "ai") setPaused(true);
        };

        window.addEventListener("keydown", down);

        window.addEventListener("keyup", up);

        window.addEventListener("blur", blur);

        return () => {
            window.removeEventListener("keydown", down);

            window.removeEventListener("keyup", up);

            window.removeEventListener("blur", blur);
        };
    }, [send, sendMove]);

    // ------------------------------------------------------------
    // ONLINE CONNECTION AND ROOM UPDATES
    // ------------------------------------------------------------

    useEffect(() => {
        if (mode !== "online") return;

        let disposed = false;

        let active: Socket | null = null;

        setConnection("connecting");

        void loadSocketClient()
            .then((io) => {
                if (disposed) return;

                const s = io(import.meta.env.VITE_SERVER_URL || undefined, { autoConnect: true });

                active = s;

                socket.current = s;

                s.on("connect", () => {
                    setConnection("connected");

                    setError("");

                    if (session.current) s.emit("joinRoom", session.current);
                });

                s.on("disconnect", () => setConnection("reconnecting"));

                s.on("connect_error", () => {
                    setConnection("reconnecting");

                    setError(
                        "Cannot reach the arena server. Make sure the server is running. Retrying…"
                    );
                });

                s.on("joined", (data: { code: string; token: string; index: number }) => {
                    session.current = { code: data.code, token: data.token };

                    playerIndex.current = data.index;

                    s.emit("inputMode", state.current.input);

                    setError("");
                });

                s.on("room", (data: Room) => {
                    if (!session.current || data.code !== session.current.code) return;

                    setRoom(data);

                    if (data.match) {
                        matchRef.current = data.match;

                        if (data.match.phase === "finished") finishRef.current();
                        else {
                            resultShown.current = false;

                            setPlaying(true);

                            setFinished(false);
                        }
                    }
                });

                s.on("state", (data: Match) => {
                    if (!session.current) return;

                    matchRef.current = data;

                    if (data.phase === "finished") finishRef.current();
                });

                s.on("roomError", (message: string) => setError(message));
            })
            .catch((e) => {
                if (!disposed) {
                    setError(e.message);

                    setConnection("offline");
                }
            });

        return () => {
            disposed = true;

            active?.disconnect();

            socket.current = null;

            session.current = null;

            setRoom(null);

            setConnection("offline");
        };
    }, [mode, connectionAttempt]);

    useEffect(() => {
        if (mode === "online") socket.current?.emit("inputMode", input);
        else setInputMode(matchRef.current, 0, input);
    }, [input, mode]);

    // ------------------------------------------------------------
    // START A ROUND OR SIGNAL ONLINE READINESS
    // ------------------------------------------------------------

    const start = () => {
        if (mode === "ai" && (!modelReady || !modelUrl)) return;

        if (autoFullscreen) enterFullscreen();

        unlockAudio();

        setError("");

        setPaused(false);

        if (mode === "online") {
            socket.current?.emit("ready", { inputMode: input });

            return;
        }

        resultShown.current = false;

        setFinished(false);

        matchRef.current = createMatch();

        setInputMode(matchRef.current, 0, input);

        botRef.current = new LearnedBot(difficulty, Date.now() >>> 0, modelUrl!);

        setModelStatus("connecting");

        setPlaying(true);
    };

    // ------------------------------------------------------------
    // RECORD THE RESULT AND SESSION HISTORY
    // ------------------------------------------------------------

    const finish = useCallback(() => {
        if (resultShown.current) return;

        resultShown.current = true;

        setFinished(true);

        const match = matchRef.current,
            index = playerIndex.current;

        const result: RoundRecord["result"] =
            match.winner === null ? "DRAW" : match.winner === index ? "WIN" : "LOSS";

        if (result === "WIN") setWins((v) => v + 1);

        setRounds((previous) =>
            [
                {
                    id: Date.now(),
                    opponent:
                        mode === "online"
                            ? room?.players[1 - index]?.name || "ONLINE RIVAL"
                            : difficulty === "easy"
                              ? "ROOKIE"
                              : difficulty === "medium"
                                ? "AXEL"
                                : "IRON REX",
                    result,
                    reason: match.reason,
                    hits: match.fighters[index].hits,
                    damage: match.fighters[index].damage
                },
                ...previous
            ].slice(0, 5)
        );
    }, [mode, room, difficulty]);

    finishRef.current = finish;

    // ------------------------------------------------------------
    // LEAVE THE ARENA AND RESET THE SESSION
    // ------------------------------------------------------------

    const leave = () => {
        setFightMenu(false);

        exitFightView();

        gloveStartPending.current = false;

        send("block", false);

        sendMove(0);

        if (mode === "online") {
            socket.current?.emit("leaveRoom");

            session.current = null;

            setRoom(null);
        }

        resultShown.current = false;

        setPlaying(false);

        setFinished(false);

        setPaused(false);

        setInput("keyboard");

        matchRef.current = createMatch();

        botRef.current = null;
    };

    // ------------------------------------------------------------
    // START A CALIBRATED MATCH WITH A HAND GESTURE
    // ------------------------------------------------------------

    const canGloveStart =
        input === "motion" &&
        cameraReady &&
        !playing &&
        !help &&
        !settings &&
        ((mode === "ai" && modelReady) ||
            (mode === "online" &&
                !!room &&
                room.players.length >= 2 &&
                connection === "connected" &&
                !room.players[playerIndex.current]?.ready));

    const touchGloves = () => {
        if (!canGloveStart || gloveStartPending.current) return;

        gloveStartPending.current = true;

        start();
    };

    const changeMode = (next: "ai" | "online") => {
        setMode(next);

        setError("");

        matchRef.current = createMatch();

        playerIndex.current = 0;
    };

    // ------------------------------------------------------------
    // FIGHTER NAMES AND RESULT LABELS
    // ------------------------------------------------------------

    const opponent =
        difficulty === "easy" ? "ROOKIE" : difficulty === "medium" ? "AXEL" : "IRON REX";

    const names: [string, string] =
        mode === "online"
            ? [room?.players[0]?.name || "FIGHTER 1", room?.players[1]?.name || "WAITING…"]
            : [name || "YOU", opponent];

    const outcome =
        matchRef.current.winner === null
            ? "DRAW"
            : matchRef.current.winner === playerIndex.current
              ? "VICTORY"
              : "DEFEAT";

    useEffect(() => {
        const sync = () => setMusicEnabled(!muted && !document.hidden && !paused);

        sync();

        document.addEventListener("visibilitychange", sync);

        return () => {
            document.removeEventListener("visibilitychange", sync);

            setMusicEnabled(false);
        };
    }, [muted, paused]);

    useEffect(() => () => disposeMusic(), []);

    // ------------------------------------------------------------
    // SOUND CONTROLS
    // ------------------------------------------------------------

    const toggleMute = () => {
        unlockAudio();

        setMuted((v) => !v);
    };

    // ------------------------------------------------------------
    // ARCADE PAGE, MATCH CONTROLS, AND DIALOGS
    // ------------------------------------------------------------

    return (
        <div
            className={`app game-shell ${cornerOpen ? "corner-open" : "corner-closed"} ${immersive ? "fight-view" : ""} ${input === "motion" ? "has-motion-camera" : ""} ${scanlines ? "" : "no-scanlines"}`}
        >
            <PixelBackdrop quiet={playing} />
            {fightMenu && (
                <FightMenu
                    online={mode === "online"}
                    fullscreenHint={fullscreenHint}
                    onResume={() => {
                        setFightMenu(false);

                        setPaused(false);
                    }}
                    onExit={() => {
                        setFightMenu(false);

                        setPaused(false);

                        exitFightView();
                    }}
                    onLeaveMatch={leave}
                    onFullscreen={enterFullscreen}
                />
            )}

            <header className="site-header">
                <a className="brand" href="/" aria-label="Block Brawl home">
                    <div>
                        BLOCK <em>BRAWL</em>
                        <span>IRON & OAK BOXING CLUB</span>
                    </div>
                </a>
                <nav className="cabinet-nav" aria-label="Main navigation">
                    <a
                        className={!playbookOpen ? "active" : ""}
                        href="#arcade"
                        onClick={() => setPlaybookOpen(false)}
                    >
                        ◂ ARCADE ▸
                    </a>
                    <a
                        className={
                            playbookOpen && toolTab === "moves" ? "manual-nav active" : "manual-nav"
                        }
                        href="#moves"
                        onClick={() => {
                            setToolTab("moves");
                            setPlaybookOpen(true);
                        }}
                    >
                        MOVE LAB
                    </a>
                    <a
                        className={playbookOpen && toolTab === "fighters" ? "active" : ""}
                        href="#fighters"
                        onClick={() => {
                            setToolTab("fighters");
                            setPlaybookOpen(true);
                        }}
                    >
                        FIGHTERS
                    </a>
                    <a
                        className={playbookOpen && toolTab === "rounds" ? "active" : ""}
                        href="#rounds"
                        onClick={() => {
                            setToolTab("rounds");
                            setPlaybookOpen(true);
                        }}
                    >
                        YOUR ROUNDS
                    </a>
                    <button
                        onClick={() => {
                            send("block", false);

                            sendMove(0);

                            if (playing && mode === "ai") setPaused(true);

                            setHelp(true);
                        }}
                    >
                        <PixelIcon name="help" size={15} /> GUIDE
                    </button>
                    <button
                        onClick={() => {
                            send("block", false);

                            sendMove(0);

                            if (playing && mode === "ai") setPaused(true);

                            setSettings(true);
                        }}
                    >
                        <PixelIcon name="settings" size={15} /> SETTINGS
                    </button>
                    <button
                        className="cabinet-audio"
                        aria-label={muted ? "Enable sound" : "Mute sound"}
                        aria-pressed={!muted}
                        onClick={toggleMute}
                    >
                        {muted ? (
                            <PixelIcon name="muted" size={23} />
                        ) : (
                            <PixelIcon name="sound" size={23} />
                        )}
                    </button>
                    <button
                        type="button"
                        aria-label="Toggle fullscreen"
                        onClick={() => (immersive ? exitFightView() : enterFullscreen())}
                    >
                        <PixelIcon name="expand" size={18} />
                    </button>
                </nav>
            </header>
            <button
                className="corner-toggle"
                type="button"
                aria-expanded={cornerOpen}
                aria-controls="corner-panel"
                onClick={() => setCornerOpen((open) => !open)}
            >
                <span aria-hidden="true">{cornerOpen ? "›" : "‹"}</span>
                {cornerOpen ? "HIDE CORNER" : "YOUR CORNER"}
            </button>
            <main>
                <div className="arcade-welcome">
                    <div>
                        <span className="eyebrow">
                            <i className="live-dot" /> FIELD HOUSE · EST. 1942
                        </span>
                        <h1>{playing ? "MAKE IT COUNT." : "EARN YOUR CORNER."}</h1>
                    </div>
                    <span className="welcome-ticket">
                        {ROUND_SECONDS} SECONDS <i /> ALL HEART.
                    </span>
                </div>
                {window.location.protocol === "file:" && (
                    <div className="standalone-notice" role="note">
                        <b>LOCAL SERVER REQUIRED</b>
                        <p>
                            Start the local server for CPU fights, webcam controls and online play.
                            Run <code>npm install</code>, then <code>npm run dev</code> in the
                            project folder and open{" "}
                            <a href="http://localhost:5173">localhost:5173</a>.
                        </p>
                    </div>
                )}
                <div className="main-layout" id="arcade" inert={playbookOpen}>
                    <div className="stage-column">
                        <div className="stage-caption">
                            <span>
                                <i className="live-dot" /> STAGE 01
                            </span>
                            <b>IRON & OAK</b>
                            <span>MILITARY FIELD HOUSE</span>
                        </div>
                        <Arena
                            aiStatus={playing && mode === "ai" ? modelStatus : undefined}
                            menuOpen={fightMenu}
                            onMenu={() => {
                                send("block", false);

                                sendMove(0);

                                setFightMenu(true);

                                if (mode === "ai") setPaused(true);
                            }}
                            onUltimate={() => {
                                send("block", false);

                                send("ultimate");
                            }}
                            onFullscreen={() => (immersive ? exitFightView() : enterFullscreen())}
                            matchRef={matchRef}
                            botRef={botRef}
                            playing={playing}
                            online={mode === "online"}
                            viewIndex={mode === "online" ? (playerIndex.current as 0 | 1) : 0}
                            names={names}
                            muted={muted}
                            onMute={() => {
                                unlockAudio();

                                setMuted((v) => !v);
                            }}
                            onFinish={finish}
                            paused={
                                paused ||
                                (playing && mode === "ai" && playbookOpen) ||
                                (playing &&
                                    mode === "online" &&
                                    (!!room?.paused || connection !== "connected"))
                            }
                        />
                    </div>
                    <aside
                        id="corner-panel"
                        aria-label="Your corner and fight setup"
                        inert={!cornerOpen}
                        className={`setup-panel${playing ? " in-fight-panel" : ""}`}
                    >
                        <ChallengerCard
                            learned={mode === "ai"}
                            name={mode === "online" ? names[1 - playerIndex.current] : opponent}
                            difficulty={difficulty}
                            online={mode === "online"}
                        />
                        {!playing && (
                            <ol className="setup-checklist" aria-label="Fight readiness">
                                <li className="complete">
                                    <span>01</span>
                                    <b>CHALLENGER</b>
                                    <i>✓</i>
                                </li>
                                <li
                                    className={
                                        input === "keyboard" || cameraReady ? "complete" : ""
                                    }
                                >
                                    <span>02</span>
                                    <b>{input === "motion" ? "CALIBRATION" : "CONTROLS"}</b>
                                    <i>{input === "keyboard" || cameraReady ? "✓" : "…"}</i>
                                </li>
                                <li
                                    className={
                                        mode === "online" &&
                                        (!room ||
                                            room.players.length < 2 ||
                                            connection !== "connected")
                                            ? ""
                                            : "complete"
                                    }
                                >
                                    <span>03</span>
                                    <b>{mode === "online" ? "ROOM READY" : "FREE PLAY"}</b>
                                    <i>
                                        {mode === "online" &&
                                        (!room ||
                                            room.players.length < 2 ||
                                            connection !== "connected")
                                            ? "…"
                                            : "✓"}
                                    </i>
                                </li>
                            </ol>
                        )}
                        <div className="panel-heading">
                            <span className="eyebrow">
                                {playing ? "IN YOUR CORNER" : "PLAYER SELECT"}
                            </span>
                            <span className="step-label">
                                {playing ? (finished ? "FINAL" : "LIVE") : "P1 / READY?"}
                            </span>
                        </div>
                        {playing ? (
                            <>
                                <h2>{finished ? "THE RESULTS." : "STAY SHARP."}</h2>
                                <p className="panel-sub">
                                    {mode === "online"
                                        ? `ROOM ${room?.code} · ${connection}`
                                        : `${difficulty.toUpperCase()} · ${ROUND_SECONDS} SECOND ROUND`}
                                </p>
                                <div className="match-info">
                                    <span>YOUR FIGHTER</span>
                                    <b>{names[playerIndex.current]}</b>
                                    <span>CONTROLS</span>
                                    <b>{input === "motion" ? "Motion tracking" : "Keyboard"}</b>
                                </div>
                                {input === "keyboard" && (
                                    <div className="compact-controls">
                                        {controls.map(([key, label]) => (
                                            <div key={key}>
                                                <BoxerArt pose={commandPose(key)} />
                                                <kbd>{key}</kbd>
                                                <span>{label}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {input === "motion" && (
                                    <button
                                        className="text-button"
                                        onClick={() => {
                                            send("block", false);

                                            sendMove(0);

                                            setInput("keyboard");
                                        }}
                                    >
                                        Use keyboard instead
                                    </button>
                                )}
                                <p className="fight-tip">
                                    <PixelIcon name="bolt" size={16} />
                                    Raise your guard just before a punch lands to daze your
                                    opponent. Watch your guard bar.
                                </p>
                                {mode === "ai" && !finished && (
                                    <button
                                        className="secondary full"
                                        onClick={() => {
                                            send("block", false);

                                            setPaused((v) => !v);
                                        }}
                                    >
                                        {paused ? (
                                            <PixelIcon name="play" size={16} />
                                        ) : (
                                            <PixelIcon name="pause" size={16} />
                                        )}{" "}
                                        {paused ? "Resume fight" : "Pause fight"} <kbd>ESC</kbd>
                                    </button>
                                )}
                                <button className="text-button" onClick={leave}>
                                    Leave arena <PixelIcon name="diagonal" size={14} />
                                </button>
                            </>
                        ) : (
                            <>
                                <h2>SELECT YOUR MODE</h2>
                                <p className="panel-sub">Choose your challenge. Make your move.</p>
                                <label className="section-label">
                                    <span>01</span> YOUR CHALLENGE
                                </label>
                                <div className="mode-select">
                                    <button
                                        aria-pressed={mode === "ai"}
                                        className={mode === "ai" ? "selected" : ""}
                                        onClick={() => changeMode("ai")}
                                    >
                                        <span className="mode-illustration cpu-illustration">
                                            <BoxerArt pose="hook" />
                                            <span className="cpu-chip">CPU</span>
                                        </span>
                                        <strong>VS CPU</strong>
                                        <small>Climb the ranks</small>
                                        {mode === "ai" && (
                                            <PixelIcon
                                                name="check"
                                                size={12}
                                                className="selection-check"
                                            />
                                        )}
                                    </button>
                                    <button
                                        aria-pressed={mode === "online"}
                                        className={mode === "online" ? "selected" : ""}
                                        onClick={() => changeMode("online")}
                                    >
                                        <span className="mode-illustration duel-illustration">
                                            <BoxerArt pose="jab" />
                                            <BoxerArt pose="guard" className="duel-rival" />
                                        </span>
                                        <strong>ONLINE VS</strong>
                                        <small>Challenge a friend</small>
                                        {mode === "online" && (
                                            <PixelIcon
                                                name="check"
                                                size={12}
                                                className="selection-check"
                                            />
                                        )}
                                    </button>
                                </div>
                                {mode === "ai" ? (
                                    <>
                                        <label className="section-label">
                                            <span>02</span> DIFFICULTY
                                        </label>
                                        <div className="segmented">
                                            {(["easy", "medium", "hard"] as Difficulty[]).map(
                                                (d) => (
                                                    <button
                                                        key={d}
                                                        aria-pressed={difficulty === d}
                                                        className={
                                                            difficulty === d ? "selected" : ""
                                                        }
                                                        onClick={() => setDifficulty(d)}
                                                    >
                                                        {d}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                        <p className="difficulty-note">
                                            <i />
                                            {difficulty === "easy"
                                                ? "Trained policy with relaxed reactions and longer pauses between attacks."
                                                : difficulty === "medium"
                                                  ? "Trained policy with measured reactions and balanced attack pacing."
                                                  : "Trained policy at its fastest response speed. No scripted tactics."}
                                        </p>
                                        {!modelReady && (
                                            <p className="model-help" role="status">
                                                {!modelUrl
                                                    ? "Trained opponents are not configured for this site. The game host needs to connect the AI service."
                                                    : ["localhost", "127.0.0.1", "[::1]"].includes(
                                                            window.location.hostname
                                                        )
                                                      ? "Connecting to trained opponent… If this persists, run npm run ml:serve. Fight unlocks automatically when ready."
                                                      : modelHealth.message}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <label className="section-label">
                                            <span>02</span> YOUR PARTY{" "}
                                            <small className="connection">{connection}</small>
                                        </label>
                                        {connection === "offline" && (
                                            <button
                                                className="secondary full"
                                                onClick={() => {
                                                    setError("");
                                                    setConnectionAttempt((attempt) => attempt + 1);
                                                }}
                                            >
                                                Retry connection
                                            </button>
                                        )}
                                        {room ? (
                                            <div className="lobby">
                                                <div>
                                                    <small>PARTY CODE · CLICK TO COPY</small>
                                                    <button
                                                        className="room-code"
                                                        onClick={() => {
                                                            if (!navigator.clipboard) {
                                                                setError(
                                                                    "Copy the party code shown above to share it."
                                                                );
                                                                return;
                                                            }
                                                            void navigator.clipboard
                                                                .writeText(room.code)
                                                                .then(() => {
                                                                    setCopied(true);

                                                                    setTimeout(
                                                                        () => setCopied(false),
                                                                        2000
                                                                    );
                                                                })
                                                                .catch(() =>
                                                                    setError(
                                                                        "Copy the room code shown above to share it."
                                                                    )
                                                                );
                                                        }}
                                                    >
                                                        {room.code}
                                                        {copied ? (
                                                            <PixelIcon name="check" size={16} />
                                                        ) : (
                                                            <PixelIcon name="copy" size={16} />
                                                        )}
                                                    </button>
                                                </div>
                                                <p className="party-hint">
                                                    {room.players.length < 2
                                                        ? "Share your code or invite link with a friend. Two fighters per party."
                                                        : "Your friend is here. Choose your controls, then both press READY UP."}
                                                </p>
                                                <input
                                                    className="party-invite"
                                                    aria-label="Party invite link"
                                                    readOnly
                                                    value={partyInviteUrl(
                                                        window.location.href,
                                                        room.code
                                                    )}
                                                    onFocus={(e) => e.currentTarget.select()}
                                                />
                                                <button
                                                    className="secondary full"
                                                    onClick={() => {
                                                        const link = partyInviteUrl(
                                                            window.location.href,
                                                            room.code
                                                        );
                                                        if (!navigator.clipboard) {
                                                            setError(
                                                                "Select and copy the invite link above to share it."
                                                            );
                                                            return;
                                                        }
                                                        void navigator.clipboard
                                                            .writeText(link)
                                                            .then(() => {
                                                                setInviteCopied(true);
                                                                window.setTimeout(
                                                                    () => setInviteCopied(false),
                                                                    2000
                                                                );
                                                            })
                                                            .catch(() =>
                                                                setError(
                                                                    "Select and copy the invite link above to share it."
                                                                )
                                                            );
                                                    }}
                                                >
                                                    {inviteCopied
                                                        ? "Invite link copied!"
                                                        : "Copy invite link"}
                                                </button>
                                                {[0, 1].map((i) => (
                                                    <p key={i}>
                                                        <PixelIcon name="globe" size={13} />
                                                        <b
                                                            className="party-player-name"
                                                            title={room.players[i]?.name}
                                                        >
                                                            {room.players[i]?.name ||
                                                                "Waiting for opponent…"}
                                                        </b>
                                                        <span>
                                                            {room.players[i]?.ready
                                                                ? "READY"
                                                                : room.players[i]?.connected
                                                                  ? "CONNECTED"
                                                                  : "—"}
                                                        </span>
                                                    </p>
                                                ))}
                                                <button className="text-button" onClick={leave}>
                                                    Leave party
                                                </button>
                                            </div>
                                        ) : (
                                            <form
                                                className="room-setup"
                                                onSubmit={(e) => {
                                                    e.preventDefault();
                                                    if (
                                                        connection === "connected" &&
                                                        isPartyCode(code)
                                                    ) {
                                                        setError("");
                                                        socket.current?.emit("joinRoom", {
                                                            code,
                                                            name
                                                        });
                                                    }
                                                }}
                                            >
                                                <p className="party-hint">
                                                    Create a private party or enter your friend's
                                                    six-character code.
                                                </p>
                                                <p className="party-hint">
                                                    Cameras share automatically when both players join.
                                                    No microphone audio is shared.
                                                </p>
                                                <input
                                                    aria-label="Fighter name"
                                                    placeholder="Your fighter name"
                                                    maxLength={20}
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                />
                                                <button
                                                    type="button"
                                                    className="secondary full"
                                                    disabled={connection !== "connected"}
                                                    onClick={() =>
                                                        socket.current?.emit("createRoom", { name })
                                                    }
                                                >
                                                    Create party{" "}
                                                    <PixelIcon name="arrow" size={15} />
                                                </button>
                                                <div className="join-row">
                                                    <input
                                                        aria-label="Party code"
                                                        placeholder="PARTY CODE"
                                                        autoComplete="off"
                                                        spellCheck={false}
                                                        maxLength={6}
                                                        value={code}
                                                        onChange={(e) =>
                                                            setCode(
                                                                normalizePartyCode(e.target.value)
                                                            )
                                                        }
                                                    />
                                                    <button
                                                        type="submit"
                                                        className="secondary"
                                                        disabled={
                                                            !isPartyCode(code) ||
                                                            connection !== "connected"
                                                        }
                                                    >
                                                        Join party
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </>
                                )}
                                <label className="section-label">
                                    <span>03</span> CONTROLS
                                </label>
                                <div className="control-select">
                                    <button
                                        aria-pressed={input === "motion"}
                                        className={input === "motion" ? "selected" : ""}
                                        onClick={() => setInput("motion")}
                                    >
                                        <PixelIcon name="camera" size={19} />
                                        <span>
                                            <b>Motion controls</b>
                                            <small>Webcam moves · no stamina limit</small>
                                        </span>
                                        <i />
                                    </button>
                                    <button
                                        aria-pressed={input === "keyboard"}
                                        className={input === "keyboard" ? "selected" : ""}
                                        onClick={() => setInput("keyboard")}
                                    >
                                        <PixelIcon name="keyboard" size={19} />
                                        <span>
                                            <b>Keyboard</b>
                                            <small>Classic keys · stamina management</small>
                                        </span>
                                        <i />
                                    </button>
                                </div>
                                {error && (
                                    <p role="alert" className="error-message">
                                        {error}
                                    </p>
                                )}
                                <button
                                    className="primary full"
                                    onClick={start}
                                    disabled={
                                        (mode === "ai" && !modelReady) ||
                                        (input === "motion" && !cameraReady) ||
                                        (mode === "online" &&
                                            (!room ||
                                                room.players.length < 2 ||
                                                connection !== "connected" ||
                                                !!room.players[playerIndex.current]?.ready))
                                    }
                                >
                                    {mode === "online"
                                        ? room?.players[playerIndex.current]?.ready
                                            ? "WAITING FOR OPPONENT"
                                            : "READY UP"
                                        : "LET’S FIGHT"}
                                    <PixelIcon name="arrow" size={19} />
                                </button>
                                {input === "motion" && (
                                    <p className="start-note">
                                        Calibrate, then touch gloves to start.
                                    </p>
                                )}
                            </>
                        )}
                    </aside>
                    {mode === "online" && room && socket.current && room.players.length === 2 && (
                        <PartyCameras
                            key={`${room.code}:${connection}`}
                            socket={socket.current}
                            index={playerIndex.current}
                            motionStream={motionStream}
                            usesMotion={input === "motion"}
                            opponent={room.players[1 - playerIndex.current]?.name || "Opponent"}
                        />
                    )}
                    {input === "motion" && (
                        <div
                            className={`camera-overhang ${mode === "online" && room?.players.length === 2 ? "party-motion-tools" : ""}`}
                        >
                            <MotionCamera
                                onStream={setMotionStream}
                                isRecovering={() =>
                                    matchRef.current.phase === "knockdown" &&
                                    matchRef.current.down === playerIndex.current
                                }
                                compact={playing}
                                onTouchGloves={canGloveStart ? touchGloves : undefined}
                                onAction={send}
                                onMove={sendMove}
                                onReady={setCameraReady}
                            />
                        </div>
                    )}
                </div>
                <details
                    className="arcade-playbook"
                    data-tool={toolTab}
                    open={playbookOpen}
                    onToggle={(event) => setPlaybookOpen(event.currentTarget.open)}
                >
                    <summary>
                        <span>THE PLAYBOOK</span>
                        <small>FIGHTERS · MOVES · YOUR ROUNDS</small>
                        <span className="playbook-plus" aria-hidden="true">
                            +
                        </span>
                    </summary>
                    <div className="tool-navigation" aria-label="Arcade tools">
                        {(
                            [
                                ["fighters", "FIGHTERS"],
                                ["moves", "MOVE LAB"],
                                ["rounds", "YOUR ROUNDS"]
                            ] as const
                        ).map(([tab, label]) => (
                            <button
                                key={tab}
                                type="button"
                                aria-pressed={toolTab === tab}
                                onClick={() => {
                                    setToolTab(tab);
                                    window.location.hash = tab;
                                }}
                            >
                                {label}
                            </button>
                        ))}
                        <button
                            type="button"
                            className="close-tools"
                            onClick={() => {
                                setPlaybookOpen(false);
                                window.location.hash = "arcade";
                            }}
                            aria-label="Close tools and return to arena"
                        >
                            BACK TO ARENA ×
                        </button>
                    </div>
                    <div hidden={toolTab !== "fighters"}>
                        <CircuitRoster
                            difficulty={difficulty}
                            disabled={playing || mode === "online"}
                            onSelect={setDifficulty}
                        />
                    </div>
                    <div hidden={toolTab !== "moves"}>
                        <MoveLibrary motion={input === "motion"} />
                    </div>
                    <div hidden={toolTab !== "rounds"}>
                        <RoundHistory rounds={rounds} />
                    </div>
                </details>
            </main>
            <footer>
                <span>
                    <i className="live-dot" /> FREE PLAY. ALWAYS.
                </span>
                <span>
                    {String(wins).padStart(2, "0")} WINS <i /> MADE FOR ONE MORE ROUND.
                </span>
            </footer>
            {settings && (
                <ArcadeSettings
                    muted={muted}
                    onMute={toggleMute}
                    autoFullscreen={autoFullscreen}
                    onFullscreenChange={setAutoFullscreen}
                    scanlines={scanlines}
                    onScanlinesChange={setScanlines}
                    onClose={() => setSettings(false)}
                />
            )}
            {help && (
                <div className="modal-backdrop" onClick={() => setHelp(false)}>
                    <section
                        className="modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="guide-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="close-modal"
                            aria-label="Close guide"
                            onClick={() => setHelp(false)}
                        >
                            <PixelIcon name="close" />
                        </button>
                        <span className="eyebrow">BLOCK BRAWL / FIELD GUIDE</span>
                        <h2 id="guide-title">LEARN YOUR MOVES.</h2>
                        <p>
                            Face the camera rather than standing sideways. A slight boxing stance is
                            fine, but keep both shoulders, elbows, wrists, and hips visible. Hold a
                            relaxed guard during calibration. Lean your body toward the lens to move
                            forward or away to retreat. Punch toward the lens and snap back to
                            guard.
                        </p>
                        <div className="guide-controls">
                            {controls.map(([key, label, description]) => (
                                <div key={key}>
                                    <BoxerArt pose={commandPose(key)} />
                                    <kbd>{key}</kbd>
                                    <span>
                                        <b>{label}</b>
                                        <small>{description}</small>
                                    </span>
                                </div>
                            ))}
                        </div>
                        <p>
                            <b>Knocked down?</b> At zero health you have 10 seconds to alternate J
                            and K: 20 inputs on your first knockdown, 60 on your second, 100 on your
                            third, and 200 from your fourth knockdown onward. With the camera on,
                            move either hand up and down. Each clear vertical stroke counts once; a
                            slower lift also counts when you pause briefly at the top. Recover to 60
                            HP, or lose by knockout when the count ends.
                        </p>
                        <p>
                            <b>Stamina (keyboard only).</b> Motion controls have no stamina cost or
                            limit. With keyboard controls, you start with 250. Jabs cost 10, crosses
                            15, hooks 20, and an ultimate costs 30. Rest to regenerate slowly, or
                            block for faster recovery. Twenty-five uninterrupted jabs empty the bar.
                            You need enough stamina to start each punch.
                        </p>
                        <p>
                            <b>Fight smart.</b> Holding block reduces damage by 80% but drains the
                            guard bar. Raise it within a split second of impact for a perfect block
                            that deals no damage and dazes the attacker. An empty bar breaks guard
                            until it recovers. Slips avoid straight punches, but hooks catch them.
                            Duck under crosses and hooks; jabs catch ducks.
                        </p>
                        <p>
                            The round lasts {ROUND_SECONDS} seconds. Win by knockout or remaining
                            health. Your fighters approach and circle automatically, always facing
                            each other. Online matches pause for up to 20 seconds on disconnection.
                        </p>
                        <button className="primary full" onClick={() => setHelp(false)}>
                            READY TO FIGHT <PixelIcon name="target" size={17} />
                        </button>
                    </section>
                </div>
            )}
            {finished && (
                <div className="modal-backdrop">
                    <section
                        className="modal result"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="result-title"
                    >
                        <BoxerArt pose={outcome === "VICTORY" ? "uppercut" : "guard"} />
                        <span className="eyebrow">
                            {matchRef.current.reason === "Knockout"
                                ? "K.O. — ROUND COMPLETE"
                                : matchRef.current.reason.toUpperCase()}
                        </span>
                        <h2 id="result-title">
                            {outcome}
                            <span>.</span>
                        </h2>
                        <p>
                            {outcome === "VICTORY"
                                ? "You own this block. Ready for the next challenger?"
                                : outcome === "DRAW"
                                  ? "Nothing between you. Settle it in the next round."
                                  : "Every round makes you sharper. Get back in there."}
                        </p>
                        <div className="result-stats">
                            <div>
                                <b>{matchRef.current.fighters[playerIndex.current].hits}</b>
                                <small>HITS LANDED</small>
                            </div>
                            <div>
                                <b>{matchRef.current.fighters[playerIndex.current].damage}</b>
                                <small>DAMAGE DEALT</small>
                            </div>
                            <div>
                                <b>
                                    {Math.ceil(matchRef.current.fighters[playerIndex.current].hp)}
                                </b>
                                <small>HEALTH LEFT</small>
                            </div>
                        </div>
                        <button
                            className="primary full"
                            disabled={
                                (mode === "ai" && !modelReady) ||
                                (mode === "online" &&
                                    (!!room?.players[playerIndex.current]?.ready || !!room?.paused))
                            }
                            onClick={start}
                        >
                            {mode === "online"
                                ? room?.players[playerIndex.current]?.ready
                                    ? "WAITING FOR OPPONENT"
                                    : "READY FOR REMATCH"
                                : "REMATCH"}
                            <PixelIcon name="arrow" size={17} />
                        </button>
                        <button className="text-button" onClick={leave}>
                            Return to arcade
                        </button>
                    </section>
                </div>
            )}
        </div>
    );
}
