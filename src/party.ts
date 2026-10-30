/** Party links contain only the public code, never a fighter's reconnect token. */
export function normalizePartyCode (value: string): string {
    return value.trim().toUpperCase();
}

export function isPartyCode (value: string): boolean {
    return /^[0-9A-F]{6}$/.test(value);
}

export function partyCodeFromUrl (href: string): string {
    const code = normalizePartyCode(new URL(href).searchParams.get("party") || "");
    return isPartyCode(code) ? code : "";
}

export function partyInviteUrl (href: string, code: string): string {
    const normalized = normalizePartyCode(code);
    if (!isPartyCode(normalized)) throw new Error("Invalid party code");
    const url = new URL(href);
    url.search = "";
    url.searchParams.set("party", normalized);
    url.hash = "arcade";
    return url.toString();
}
