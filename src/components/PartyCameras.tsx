import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { attachPartyCamera } from "../camera-media";

type Signal = {
    type: "hello" | "offer" | "answer" | "candidate";
    description?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
};

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
    const peer = useRef<RTCPeerConnection | null>(null);
    const outgoing = useRef<MediaStreamTrack | null>(null);
    const [enabled, setEnabled] = useState(true);
    const [pending, setPending] = useState(false);
    const [cameraError, setCameraError] = useState("");
    const [status, setStatus] = useState("Waiting for opponent camera");

    useEffect(() => {
        if (typeof RTCPeerConnection === "undefined") {
            setStatus("Camera sharing is unavailable in this browser");
            return;
        }
        let connection: RTCPeerConnection;
        try {
            let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
            if (import.meta.env.VITE_RTC_ICE_SERVERS)
                iceServers = JSON.parse(import.meta.env.VITE_RTC_ICE_SERVERS);
            connection = new RTCPeerConnection({ iceServers });
        } catch {
            setStatus("Invalid camera connection configuration");
            return;
        }
        peer.current = connection;
        // The joining player uses the video channel created by the received offer.
        if (index === 0) connection.addTransceiver("video", { direction: "sendrecv" });
        const candidates: RTCIceCandidateInit[] = [];
        let chain = Promise.resolve();
        let closed = false;
        const send = (signal: Signal) => socket.emit("cameraSignal", signal);
        connection.onicecandidate = ({ candidate }) => {
            if (candidate) send({ type: "candidate", candidate: candidate.toJSON() });
        };
        connection.ontrack = ({ track }) => {
            if (remote.current) remote.current.srcObject = new MediaStream([track]);
            setStatus(track.muted ? "Connecting opponent camera…" : "Opponent camera connected");
            track.onmute = () => setStatus("Opponent camera paused");
            track.onunmute = () => setStatus("Opponent camera connected");
        };
        connection.onconnectionstatechange = () => {
            if (["failed", "disconnected"].includes(connection.connectionState))
                setStatus("Reconnecting opponent camera automatically…");
            else if (connection.connectionState === "connected")
                setStatus("Opponent camera connected");
        };
        const receive = (signal: Signal) => {
            chain = chain
                .then(async () => {
                    if (closed) return;
                    if (signal.type === "hello") {
                        if (index !== 0) return;
                        if (connection.signalingState !== "stable") return;
                        if (
                            connection.connectionState === "connecting" ||
                            connection.connectionState === "connected"
                        )
                            return;
                        connection.restartIce();
                        await connection.setLocalDescription(await connection.createOffer());
                        send({ type: "offer", description: connection.localDescription! });
                    } else if (signal.description) {
                        await connection.setRemoteDescription(signal.description);
                        await attachPartyCamera(connection, outgoing.current);
                        for (const candidate of candidates.splice(0))
                            await connection.addIceCandidate(candidate);
                        if (signal.type === "offer") {
                            await connection.setLocalDescription(await connection.createAnswer());
                            send({ type: "answer", description: connection.localDescription! });
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
        let retryTicks = 0;
        const retry = setInterval(() => {
            retryTicks++;
            if (connection.connectionState === "connected") return;
            // Recover a listener/startup race within a second. Once ICE is in
            // progress, give it time to finish instead of repeatedly restarting.
            if (!(retryTicks <= 5 && connection.connectionState === "new") && retryTicks % 20 !== 0)
                return;
            if (index === 0) receive({ type: "hello" });
            else send({ type: "hello" });
        }, 1000);
        return () => {
            closed = true;
            clearInterval(retry);
            socket.off("cameraSignal", receive);
            connection.close();
            peer.current = null;
        };
    }, [socket, index]);

    useEffect(() => {
        const connection = peer.current;
        if (!connection || !enabled || (usesMotion && !motionStream)) return;
        let disposed = false;
        let captured: MediaStream | null = null;
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
                outgoing.current = stream.getVideoTracks()[0] ?? null;
                await attachPartyCamera(connection, outgoing.current);
                if (!disposed && local.current) local.current.srcObject = stream;
            } catch {
                if (!disposed)
                    setCameraError("Allow camera access in your browser, then resume the camera.");
            } finally {
                if (!disposed) setPending(false);
            }
        };
        void start();
        return () => {
            disposed = true;
            outgoing.current = null;
            captured?.getTracks().forEach((track) => track.stop());
            setPending(false);
            if (connection.signalingState !== "closed")
                void attachPartyCamera(connection, null).catch(() => {});
            if (local.current) local.current.srcObject = null;
        };
    }, [motionStream, usesMotion, enabled, socket, index]);

    return (
        <div className="party-cameras">
            <div
                className={`party-camera party-camera-local party-camera-${index === 0 ? "left" : "right"}`}
            >
                <video ref={local} autoPlay playsInline muted aria-label="Your shared camera" />
                <span role="status">
                    {cameraError ||
                        (!enabled
                            ? "Your camera is off"
                            : pending
                              ? "Opening your camera…"
                              : usesMotion && !motionStream
                                ? "Waiting for your motion camera…"
                                : "Your camera · shared with your party")}
                </span>
                <button onClick={() => setEnabled(!enabled)}>
                    {pending && enabled
                        ? "Opening camera… · Stop"
                        : enabled
                          ? "Stop sharing camera"
                          : "Resume camera"}
                </button>
            </div>
            <div
                className={`party-camera party-camera-remote party-camera-${index === 0 ? "right" : "left"}`}
            >
                <video
                    ref={remote}
                    autoPlay
                    playsInline
                    muted
                    aria-label={`${opponent}'s camera`}
                />
                <span>
                    {opponent} · {status}
                </span>
            </div>
        </div>
    );
}
