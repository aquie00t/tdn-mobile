import { describe, expect, it } from "vitest";

import {
    EMAIL_PATTERN,
    validateNewPassword,
    validateUsername,
} from "./account-rules";

describe("validateUsername", () => {
    it("accepts letters, digits, dots and underscores", () => {
        expect(validateUsername("ada.lovelace_1815")).toBeNull();
    });

    it("holds the bounds the register schema holds", () => {
        expect(validateUsername("ab")).toBe("tooShort");
        expect(validateUsername("abc")).toBeNull();
        expect(validateUsername("a".repeat(30))).toBeNull();
        expect(validateUsername("a".repeat(31))).toBe("tooLong");
    });

    it("refuses what could never have been registered", () => {
        // The change-username schema accepts any string, so this is the only
        // thing standing between a profile URL and a space.
        expect(validateUsername("ada lovelace")).toBe("invalidCharacters");
        expect(validateUsername("ada-lovelace")).toBe("invalidCharacters");
        expect(validateUsername("ädä")).toBe("invalidCharacters");
    });

    it("reports the length before the characters", () => {
        expect(validateUsername("a ")).toBe("tooShort");
    });
});

describe("validateNewPassword", () => {
    it("accepts a long enough password typed the same twice", () => {
        expect(
            validateNewPassword("correct horse", "correct horse"),
        ).toBeNull();
    });

    it("reports a mismatch before the length", () => {
        expect(validateNewPassword("short", "shorter")).toBe("mismatch");
    });

    it("holds the eight-character floor", () => {
        expect(validateNewPassword("1234567", "1234567")).toBe("tooShort");
        expect(validateNewPassword("12345678", "12345678")).toBeNull();
    });
});

describe("EMAIL_PATTERN", () => {
    it("lets an ordinary address through", () => {
        expect(EMAIL_PATTERN.test("ada@example.com")).toBe(true);
        expect(EMAIL_PATTERN.test("ada+tdn@mail.example.co.uk")).toBe(true);
    });

    it("catches the typing slips", () => {
        expect(EMAIL_PATTERN.test("ada.example.com")).toBe(false);
        expect(EMAIL_PATTERN.test("ada@example")).toBe(false);
        expect(EMAIL_PATTERN.test("ada @example.com")).toBe(false);
    });
});
