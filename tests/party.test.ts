import { test } from "node:test";
import assert from "node:assert/strict";
import { isPartyCode, normalizePartyCode, partyCodeFromUrl, partyInviteUrl } from "../src/party";

test("party invites round-trip the public code without leaking other URL data", () => {
    const invite = partyInviteUrl("https://boxing.example/game?token=secret#moves", " abc123 ");
    assert.equal(invite, "https://boxing.example/game?party=ABC123#arcade");
    assert.equal(partyCodeFromUrl(invite), "ABC123");
    assert.equal(partyCodeFromUrl("http://localhost:5173/?party=abc123"), "ABC123");
});

test("invalid invites cannot preselect a party and codes follow the server format", () => {
    assert.equal(normalizePartyCode(" abc123 "), "ABC123");
    for (const code of ["", "ABC12", "ABC1234", "ZZZZZZ", "<img>"]) {
        assert.equal(isPartyCode(code), false);
        assert.equal(
            partyCodeFromUrl(`https://boxing.example/?party=${encodeURIComponent(code)}`),
            ""
        );
        assert.throws(() => partyInviteUrl("https://boxing.example/", code));
    }
});
