// ============================================================
// ARCADE SETTINGS INTERFACE
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { useEffect, useRef } from "react";
import { PixelIcon } from "./PixelIcon";

// ------------------------------------------------------------
// ARCADE SETTINGS
// ------------------------------------------------------------

export function ArcadeSettings ({
    muted,
    onMute,
    autoFullscreen,
    onFullscreenChange,
    scanlines,
    onScanlinesChange,
    onClose
}: {
    muted: boolean;
    onMute: () => void;
    autoFullscreen: boolean;
    onFullscreenChange: (value: boolean) => void;
    scanlines: boolean;
    onScanlinesChange: (value: boolean) => void;
    onClose: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        dialog.current?.showModal();
    }, []);

    return (
        <dialog
            ref={dialog}
            className="modal arcade-settings"
            aria-labelledby="settings-title"
            onCancel={onClose}
            onClose={onClose}
        >
            <button className="close-modal" aria-label="Close settings" onClick={onClose}>
                <PixelIcon name="close" />
            </button>
            <span className="eyebrow">CABINET CONFIGURATION</span>
            <h2 id="settings-title">YOUR SETUP.</h2>
            <p>Set your corner up before the bell.</p>
            <div className="settings-options">
                <label>
                    <span>
                        <b>Music & sound</b>
                        <small>Mellow pixel music, punches, blocks, and the bell</small>
                    </span>
                    <input type="checkbox" checked={!muted} onChange={onMute} />
                </label>
                <label>
                    <span>
                        <b>Automatic fullscreen</b>
                        <small>Enter fight view when starting a match</small>
                    </span>
                    <input
                        type="checkbox"
                        checked={autoFullscreen}
                        onChange={(e) => onFullscreenChange(e.target.checked)}
                    />
                </label>
                <label>
                    <span>
                        <b>CRT scanlines</b>
                        <small>A classic arcade screen finish</small>
                    </span>
                    <input
                        type="checkbox"
                        checked={scanlines}
                        onChange={(e) => onScanlinesChange(e.target.checked)}
                    />
                </label>
            </div>
            <button className="primary full" onClick={onClose}>
                BACK TO ARCADE
            </button>
        </dialog>
    );
}
