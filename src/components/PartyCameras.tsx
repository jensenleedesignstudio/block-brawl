import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { attachPartyCamera } from "../camera-media";
import { loadPartyCameraConfiguration } from "../camera-config";
import { cameraOffer } from "../camera-signaling";
import { isCameraSignal, type CameraSignal } from "../../shared/camera";

/** Video is optional and independent of authoritative combat and motion input. */
export function PartyCameras ({
    socket,
    index,
    motionStream,
    usesMotion,
    opponent
}: {
    socket: Socket;
    index: number;
    motionStream: MediaStream | null;
    usesMotion: boolean;
    opponent: string;
}) {
    const local = useRef<HTMLVideoElement>(null);
    const remote = useRef<HTMLVideoElement>(null);
    const [activePeer, setActivePeer] = useState<RTCPeerConnection | null>(null);
    const outgoing = useRef<MediaStreamTrack | null>(null);
    const [enabled, setEnabled] = useState(true);
    const [pending, setPending] = useState(false);
    const [cameraError, setCameraError] = useState("");
    const [cameraRetry, setCameraRetry] = useState(0);
    const [configurationRetry, setConfigurationRetry] = useState(0);
    const [status, setStatus] = useState("Waiting for opponent camera");

    useEffect(() => {
        let disposed = false;
        let stop = () => {};
        let retryConfiguration: ReturnType<typeof setTimeout> | undefined;
        const abort = new AbortController();
        const initialize = async () => {
            if (typeof RTCPeerConnection === "undefined") {
                setStatus("Camera sharing is unavailable in this browser");
                return;
            }
            let connection: RTCPeerConnection;
            const configuration = () =>
                loadPartyCameraConfiguration(
                    import.meta.env.VITE_RTC_ICE_SERVERS,
                    import.meta.env.VITE_RTC_RELAY_ONLY === "true",
                    import.meta.env.VITE_RTC_ICE_SERVERS_URL,
                    abort.signal
                );
            try {
                const settings = await configuration();
                if (disposed) return;
                connection = new RTCPeerConnection(settings);
            } catch {
                if (!disposed) {
                    setStatus(
                        import.meta.env.VITE_RTC_ICE_SERVERS_URL
                            ? "Camera service unavailable. Retrying…"
                            : "Camera service is not configured correctly. The match can continue."
                    );
                    if (import.meta.env.VITE_RTC_ICE_SERVERS_URL)
                        retryConfiguration = setTimeout(
                            () => setConfigurationRetry((value) => value + 1),
                            5000
                        );
                }
                return;
            }
            stop = () => connection.close();
            let configuredAt = Date.now();
            const refreshConfiguration = async () => {
                if (!import.meta.env.VITE_RTC_ICE_SERVERS_URL || Date.now() - configuredAt < 60_000)
                    return;
                const settings = await configuration();
                if (disposed) return;
                connection.setConfiguration(settings);
                configuredAt = Date.now();
            };
            // The joining player uses the video channel created by the received offer.
            if (index === 0) connection.addTransceiver("video", { direction: "sendrecv" });
            const candidates: RTCIceCandidateInit[] = [];
            let chain = Promise.resolve();
            let closed = false;
            let retry: ReturnType<typeof setTimeout> | undefined;
            let retryTicks = 0;
            const session = crypto.randomUUID();
            let remoteSession: string | undefined;
            const send = (signal: Omit<CameraSignal, "session" | "target">) =>
                socket.emit("cameraSignal", {
                    ...signal,
                    session,
                    ...(signal.type !== "hello" && remoteSession ? { target: remoteSession } : {})
                });
            connection.onicecandidate = ({ candidate }) => {
                if (candidate && !closed)
                    send({
                        type: "candidate",
                        candidate: { ...candidate.toJSON(), candidate: candidate.candidate }
                    });
            };
            connection.ontrack = ({ track }) => {
                if (closed) return;
                if (remote.current) remote.current.srcObject = new MediaStream([track]);
                setStatus(
                    track.muted ? "Connecting opponent camera…" : "Opponent camera connected"
                );
                track.onmute = () => {
                    if (!closed) setStatus("Opponent camera paused");
                };
                track.onunmute = () => {
                    if (!closed) setStatus("Opponent camera connected");
                };
            };
            connection.onconnectionstatechange = () => {
                if (closed) return;
                if (["failed", "disconnected"].includes(connection.connectionState))
                    setStatus("Reconnecting opponent camera automatically…");
                else if (connection.connectionState === "connected")
                    setStatus(
                        remote.current && remote.current.readyState >= 2
                            ? "Opponent camera connected"
                            : "Connected; waiting for opponent video…"
                    );
                scheduleRetry();
            };
            const receive = (signal: unknown) => {
                if (!isCameraSignal(signal) || (signal.target && signal.target !== session)) return;
                chain = chain
                    .then(async () => {
                        if (closed) return;
                        if (signal.type === "hello") {
                            const newPeer = !!signal.session && signal.session !== remoteSession;
                            if (newPeer) {
                                remoteSession = signal.session;
                                candidates.length = 0;
                                send({ type: "hello" });
                            }
                            if (index !== 0) return;
                            if (
                                connection.connectionState === "failed" ||
                                connection.connectionState === "disconnected"
                            )
                                await refreshConfiguration();
                            if (disposed) return;
                            const offer = await cameraOffer(connection, newPeer);
                            if (offer)
                                send({
                                    type: "offer",
                                    description: { type: "offer", sdp: offer.sdp }
                                });
                        } else if (
                            signal.session &&
                            remoteSession &&
                            signal.session !== remoteSession
                        ) {
                            return;
                        } else if (signal.description) {
                            if (signal.type === "offer") await refreshConfiguration();
                            if (disposed) return;
                            await connection.setRemoteDescription(signal.description);
                            await attachPartyCamera(connection, outgoing.current);
                            for (const candidate of candidates.splice(0))
                                await connection.addIceCandidate(candidate);
                            if (signal.type === "offer") {
                                await connection.setLocalDescription(
                                    await connection.createAnswer()
                                );
                                send({
                                    type: "answer",
                                    description: {
                                        type: "answer",
                                        sdp: connection.localDescription!.sdp
                                    }
                                });
                            }
                        } else if (signal.candidate) {
                            if (connection.remoteDescription)
                                await connection.addIceCandidate(signal.candidate);
                            else if (candidates.length < 64) candidates.push(signal.candidate);
                        }
                    })
                    .catch(() => {
                        if (!closed)
                            setStatus("Camera connection unavailable. The match can continue.");
                    });
            };
            socket.on("cameraSignal", receive);
            send({ type: "hello" });
            // The first hello may precede the other player's listener. Retry the
            // handshake and ICE without leaving the room or touching combat state.
            function scheduleRetry () {
                clearTimeout(retry);
                if (closed || connection.connectionState === "connected") return;
                const delay =
                    retryTicks < 5 && connection.connectionState === "new" ? 1000 : 20_000;
                retry = setTimeout(() => {
                    retryTicks++;
                    if (index === 0) receive({ type: "hello" });
                    else send({ type: "hello" });
                    scheduleRetry();
                }, delay);
            }
            scheduleRetry();
            stop = () => {
                closed = true;
                clearTimeout(retry);
                socket.off("cameraSignal", receive);
                connection.close();
                if (remote.current) remote.current.srcObject = null;
            };
            setActivePeer(connection);
        };
        void initialize().catch(() => {
            stop();
            if (!disposed) setStatus("Camera connection unavailable. The match can continue.");
        });
        return () => {
            disposed = true;
            abort.abort();
            clearTimeout(retryConfiguration);
            stop();
            setActivePeer(null);
        };
    }, [socket, index, configurationRetry]);

    useEffect(() => {
        const connection = activePeer;
        if (!connection || !enabled || (usesMotion && !motionStream)) return;
        let disposed = false;
        let captured: MediaStream | null = null;
        let attached: MediaStreamTrack | undefined;
        const cameraEnded = () => {
            if (!disposed) setCameraError("Camera stopped. Reconnect it and retry.");
        };
        const start = async () => {
            setPending(true);
            setCameraError("");
            try {
                const stream =
                    motionStream ??
                    (await navigator.mediaDevices.getUserMedia({
                        video: {
                            width: { ideal: 640 },
                            height: { ideal: 480 },
                            frameRate: { ideal: 30, max: 30 }
                        },
                        audio: false
                    }));
                if (!motionStream) captured = stream;
                if (disposed) {
                    captured?.getTracks().forEach((track) => track.stop());
                    return;
                }
                attached = stream.getVideoTracks()[0];
                if (!attached || attached.readyState === "ended")
                    throw new Error("Camera track unavailable");
                attached.addEventListener("ended", cameraEnded);
                outgoing.current = attached;
                await attachPartyCamera(connection, outgoing.current);
                if (!disposed && local.current) local.current.srcObject = stream;
            } catch {
                if (!disposed) {
                    captured?.getTracks().forEach((track) => track.stop());
                    outgoing.current = null;
                    setCameraError(
                        "Camera unavailable. Check browser permission or device access, then retry."
                    );
                }
            } finally {
                if (!disposed) setPending(false);
            }
        };
        void start();
        return () => {
            disposed = true;
            attached?.removeEventListener("ended", cameraEnded);
            outgoing.current = null;
            captured?.getTracks().forEach((track) => track.stop());
            setPending(false);
            if (connection.signalingState !== "closed")
                void attachPartyCamera(connection, null).catch(() => {});
            if (local.current) local.current.srcObject = null;
        };
    }, [motionStream, usesMotion, enabled, activePeer, cameraRetry]);

    const localStatus =
        cameraError ||
        (!enabled
            ? "Camera off"
            : pending
              ? "Opening camera…"
              : !activePeer
                ? "Connecting…"
                : usesMotion && !motionStream
                  ? "Waiting for motion camera…"
                  : "");
    const remoteLive = status === "Opponent camera connected";

    return (
        <div className="party-cameras">
            <div
                className={`party-camera party-camera-local party-camera-${index === 0 ? "left" : "right"}`}
            >
                <div className="party-camera-picture">
                    <video ref={local} autoPlay playsInline muted aria-label="Your shared camera" />
                    <span className="party-camera-status" role="status">
                        {localStatus}
                    </span>
                </div>
                <div className="party-camera-bar">
                    <b className="party-camera-name">You</b>
                    <button
                        className={`party-camera-toggle${enabled && !cameraError ? " is-sharing" : ""}`}
                        onClick={() => {
                            if (cameraError) setCameraRetry((value) => value + 1);
                            else setEnabled(!enabled);
                        }}
                    >
                        {cameraError ? "Retry camera" : enabled ? "Stop camera" : "Resume camera"}
                    </button>
                </div>
            </div>
            <div
                className={`party-camera party-camera-remote party-camera-${index === 0 ? "right" : "left"}`}
            >
                <div className="party-camera-picture">
                    <video
                        ref={remote}
                        onLoadedData={() => setStatus("Opponent camera connected")}
                        autoPlay
                        playsInline
                        muted
                        aria-label={`${opponent}'s camera`}
                    />
                    <span className="party-camera-status" role="status">
                        {remoteLive ? "" : status}
                    </span>
                </div>
                <div className="party-camera-bar">
                    <b className="party-camera-name" title={opponent}>
                        {opponent}
                    </b>
                    <span className="party-camera-live" role="status">
                        {remoteLive ? "Live" : ""}
                    </span>
                </div>
            </div>
        </div>
    );
}
