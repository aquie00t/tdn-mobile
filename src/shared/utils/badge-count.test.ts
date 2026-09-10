import { describe, expect, it } from "vitest";

import { formatBadgeCount } from "./badge-count";

describe("formatBadgeCount", () => {
    it("draws nothing when there is nothing unread", () => {
        // Not "0". A badge showing zero says there is something to look at.
        expect(formatBadgeCount(0)).toBeNull();
    });

    it("draws the count up to the cap", () => {
        expect(formatBadgeCount(1)).toBe("1");
        expect(formatBadgeCount(9)).toBe("9");
    });

    it("caps at 9+", () => {
        expect(formatBadgeCount(10)).toBe("9+");
        expect(formatBadgeCount(2500)).toBe("9+");
    });

    it("draws nothing for a negative count", () => {
        // A count that went below zero is a bug upstream, not a badge.
        expect(formatBadgeCount(-3)).toBeNull();
    });

    it("survives a count that is not a whole number", () => {
        expect(formatBadgeCount(3.7)).toBe("3");
        expect(formatBadgeCount(0.4)).toBeNull();
        expect(formatBadgeCount(Number.NaN)).toBeNull();
    });
});
