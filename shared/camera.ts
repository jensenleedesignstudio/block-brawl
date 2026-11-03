// Video connection metadata only. Authoritative combat never depends on this.
export interface CameraSignal {
    type: "hello" | "offer" | "answer" | "candidate";
    session?: string;
    target?: string;
    description?: { type: "offer" | "answer"; sdp: string };
    candidate?: {
        candidate: string;
        sdpMid?: string | null;
        sdpMLineIndex?: number | null;
        usernameFragment?: string | null;
    };
}

/** Bound and validate metadata before it reaches the other seated player. */
export function isCameraSignal (value: unknown): value is CameraSignal {
    if (!value || typeof value !== "object") return false;
    const data = value as CameraSignal;
    for (const id of [data.session, data.target]) {
        if (id !== undefined && (typeof id !== "string" || !/^[\w-]{1,64}$/.test(id))) return false;
    }
    if (data.type === "hello")
        return data.description === undefined && data.candidate === undefined;
    if (data.type === "offer" || data.type === "answer") {
        return (
            data.description?.type === data.type &&
            typeof data.description.sdp === "string" &&
            data.description.sdp.length > 0 &&
            data.description.sdp.length <= 16000 &&
            data.candidate === undefined
        );
    }
    if (data.type !== "candidate" || data.description !== undefined) return false;
    const candidate = data.candidate;
    return (
        !!candidate &&
        typeof candidate.candidate === "string" &&
        candidate.candidate.length <= 2048 &&
        (candidate.sdpMid == null ||
            (typeof candidate.sdpMid === "string" && candidate.sdpMid.length <= 256)) &&
        (candidate.sdpMLineIndex == null ||
            (Number.isInteger(candidate.sdpMLineIndex) &&
                candidate.sdpMLineIndex >= 0 &&
                candidate.sdpMLineIndex <= 65535)) &&
        (candidate.usernameFragment == null ||
            (typeof candidate.usernameFragment === "string" &&
                candidate.usernameFragment.length <= 256))
    );
}
