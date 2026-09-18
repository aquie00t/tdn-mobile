import { describe, expect, it } from "vitest";

import { addTag, isValidTag, normaliseTag } from "./tags";

describe("normaliseTag", () => {
    it("lowercases, trims and hyphenates spaces", () => {
        expect(normaliseTag("  Clean Architecture ")).toBe(
            "clean-architecture",
        );
    });

    it("transliterates Turkish letters rather than dropping them", () => {
        expect(normaliseTag("yazılım")).toBe("yazilim");
        expect(normaliseTag("Güvenlik Öğrenme Çalışması")).toBe(
            "guvenlik-ogrenme-calismasi",
        );
    });

    it("folds the dotted capital I to a plain i", () => {
        expect(normaliseTag("İstanbul")).toBe("istanbul");
    });

    it("removes whatever is still outside the pattern", () => {
        expect(normaliseTag("c++ & #rust!")).toBe("c--rust");
    });

    it("cuts at thirty characters", () => {
        expect(normaliseTag("a".repeat(40))).toHaveLength(30);
    });
});

describe("isValidTag", () => {
    it("accepts what the server's pattern accepts", () => {
        expect(isValidTag("react-native")).toBe(true);
        expect(isValidTag("")).toBe(false);
        expect(isValidTag("Upper")).toBe(false);
    });
});

describe("addTag", () => {
    it("appends the normalised tag", () => {
        expect(addTag(["go"], "Rust Lang", 5)).toEqual(["go", "rust-lang"]);
    });

    it("returns the same list for a duplicate, an empty tag or a full list", () => {
        const tags = ["go", "rust"];
        expect(addTag(tags, "GO", 5)).toBe(tags);
        expect(addTag(tags, "!!!", 5)).toBe(tags);
        expect(addTag(tags, "zig", 2)).toBe(tags);
    });
});
