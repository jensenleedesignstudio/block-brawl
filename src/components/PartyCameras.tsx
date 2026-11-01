import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

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
    opponent
}: {
    socket: Socket;
    index: number;
    motionStream: MediaStream | null;
    opponent: string;
}) {
    const local = useRef<HTMLVideoElement>(null);
    const remote = useRef<HTMLVideoElement>(null);
    const peer = useRef<RTCPeerConnection | null>(null);
    const owned = useRef<MediaStream | null>(null);
    const sharing = useRef(false);
    const mounted = useRef(false);
    const [enabled, setEnabled] = useState(false);
    const [pending, setPending] = useState(false);
    const [status, setStatus] = useState("Waiting for opponent camera");

    useEffect(() => {
        mounted.current = true;
        if (typeof RTCPeerConnection === "undefined") {
            setStatus("Camera sharing is unavailable in this browser");
            return () => {
                mounted.current = false;
            };
        }
        let connection: RTCPeerConnection;
        try {
            let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
            if (import.meta.env.VITE_RTC_ICE_SERVERS)
                iceServers = JSON.parse(import.meta.env.VITE_RTC_ICE_SERVERS);
            connection = new RTCPeerConnection({ iceServers });
        } catch {
            setStatus("Invalid camera connection configuration");
            return () => {
                mounted.current = false;
            };
        }
        peer.current = connection;
        connection.addTransceiver("video", { direction: "sendrecv" });
        const candidates: RTCIceCandidateInit[] = [];
        let chain = Promise.resolve();
        let closed = false;
        const send = (signal: Signal) => socket.emit("cameraSignal", signal);
        connection.onicecandidate = ({ candidate }) => {
            if (candidate) send({ type: "candidate", candidate: candidate.toJSON() });
        };
        connection.ontrack = ({ track }) => {
            if (remote.current) remote.current.srcObject = new MediaStream([track]);
            setStatus("Opponent camera connected");
            track.onmute = () => setStatus("Opponent camera paused");
            track.onunmute = () => setStatus("Opponent camera connected");
        };
        connection.onconnectionstatechange = () => {
            if (["failed", "disconnected"].includes(connection.connectionState))
                setStatus("Camera connection interrupted. Rejoin the party to retry.");
        };
        const receive = (signal: Signal) => {
            chain = chain
                .then(async () => {
                    if (closed) return;
                    if (signal.type === "hello") {
                        if (index !== 0) return;
                        connection.restartIce();
                        await connection.setLocalDescription(await connection.createOffer());
                        send({ type: "offer", description: connection.localDescription! });
                    } else if (signal.description) {
                        await connection.setRemoteDescription(signal.description);
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
        return () => {
            closed = true;
            mounted.current = false;
            socket.off("cameraSignal", receive);
            connection.close();
            peer.current = null;
            owned.current?.getTracks().forEach((track) => track.stop());
            owned.current = null;
        };
    }, [socket, index]);

    useEffect(() => {
        if (!enabled || !motionStream) return;
        const track = motionStream.getVideoTracks()[0];
        owned.current?.getTracks().forEach((item) => item.stop());
        owned.current = null;
        const sender = peer.current?.getSenders()[0];
        if (sender)
            void sender.replaceTrack(track ?? null).catch(() => setStatus("Cannot share camera"));
        if (local.current) local.current.srcObject = motionStream;
    }, [motionStream, enabled]);

    const toggle = async () => {
        if (!peer.current) return;
        if (sharing.current) {
            sharing.current = false;
            setEnabled(false);
            await peer.current?.getSenders()[0]?.replaceTrack(null);
            owned.current?.getTracks().forEach((track) => track.stop());
            owned.current = null;
            if (local.current) local.current.srcObject = null;
            return;
        }
        sharing.current = true;
        setPending(true);
        try {
            const stream =
                motionStream ??
                (await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 320 },
                        height: { ideal: 240 },
                        frameRate: { ideal: 15 }
                    },
                    audio: false
                }));
            if (!motionStream) owned.current = stream;
            if (!mounted.current) {
                if (!motionStream) stream.getTracks().forEach((track) => track.stop());
                return;
            }
            await peer.current?.getSenders()[0]?.replaceTrack(stream.getVideoTracks()[0]);
            if (local.current) local.current.srcObject = stream;
            setEnabled(true);
        } catch {
            sharing.current = false;
            owned.current?.getTracks().forEach((track) => track.stop());
            owned.current = null;
            setStatus("Camera unavailable. Allow camera access and try again.");
        } finally {
            if (mounted.current) setPending(false);
        }
    };

    return (
        <div className="party-cameras">
            <div className="party-camera party-camera-local">
                <video ref={local} autoPlay playsInline muted aria-label="Your shared camera" />
                <button disabled={pending} onClick={() => void toggle()}>
                    {pending ? "Opening camera…" : enabled ? "Stop sharing camera" : "Share camera"}
                </button>
            </div>
            <div className="party-camera party-camera-remote">
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
