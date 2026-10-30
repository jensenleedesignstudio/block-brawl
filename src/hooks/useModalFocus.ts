// ============================================================
// DIALOG KEYBOARD FOCUS AND SCROLL CONTROL
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { useEffect } from "react";

// ------------------------------------------------------------
// USE MODAL FOCUS
// ------------------------------------------------------------

/** Keep keyboard navigation in the active overlay and return to its trigger. */
export function useModalFocus (open: boolean, onDismiss?: () => void) {
    useEffect(() => {
        if (!open) return;

        const previous =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const overflow = document.body.style.overflow;

        document.body.style.overflow = "hidden";

        const dialog = document.querySelector<HTMLElement>('.modal-backdrop [role="dialog"]');

        const focusable = () =>
            Array.from(
                dialog?.querySelectorAll<HTMLElement>(
                    'button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]'
                ) ?? []
            ).filter((node) => node.getClientRects().length > 0);

        focusable()[0]?.focus();

        const keydown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && onDismiss) {
                event.preventDefault();

                event.stopPropagation();

                onDismiss();
            }

            if (event.key !== "Tab") return;

            const nodes = focusable(),
                first = nodes[0],
                last = nodes.at(-1);

            if (!first) {
                event.preventDefault();

                return;
            }

            if (
                event.shiftKey &&
                (document.activeElement === first || !dialog?.contains(document.activeElement))
            ) {
                event.preventDefault();

                last?.focus();
            } else if (
                !event.shiftKey &&
                (document.activeElement === last || !dialog?.contains(document.activeElement))
            ) {
                event.preventDefault();

                first.focus();
            }
        };

        document.addEventListener("keydown", keydown, true);

        return () => {
            document.body.style.overflow = overflow;

            document.removeEventListener("keydown", keydown, true);

            if (previous?.isConnected) previous.focus();
        };
    }, [open, onDismiss]);
}
