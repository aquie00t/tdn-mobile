import { describe, expect, it } from "vitest";

import { followTargetId } from "./follow-target";

describe("followTargetId", () => {
    it("takes the profile's id", () => {
        expect(followTargetId({ id: "u1" })).toBe("u1");
    });

    it("takes a follow row's userId", () => {
        // A profile answers with `id`, a row in a follow list with `userId`.
        expect(followTargetId({ userId: "u2" })).toBe("u2");
    });

    it("prefers id when both are present", () => {
        expect(followTargetId({ id: "u1", userId: "u2" })).toBe("u1");
    });

    it.each([
        ["nothing at all", {}],
        ["an empty string", { id: "" }],
        ["whitespace", { id: "   " }],
    ])("refuses %s", (_label, account) => {
        // The case this exists for: `""` is not dropped from a body the way
        // `undefined` is, so the request would go out, fail validation, and
        // the rollback would un-press the button with nothing said.
        expect(followTargetId(account)).toBeNull();
    });
});
