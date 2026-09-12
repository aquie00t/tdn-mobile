import { describe, expect, it } from "vitest";

import {
    MIN_FOLLOWS,
    followRequirement,
    netFollowChange,
} from "./follow-requirement";

/** A list that has arrived in full and offers more than the flow can need. */
const plenty = { followable: 50, listIsFinal: true };

const set = (...ids: string[]) => new Set(ids);

describe("followRequirement", () => {
    it("asks for five from an account that follows nobody", () => {
        const result = followRequirement({
            alreadyFollowing: 0,
            netChange: 0,
            ...plenty,
        });

        expect(result.stillNeeded).toBe(MIN_FOLLOWS);
        expect(result.required).toBe(MIN_FOLLOWS);
        expect(result.canFinish).toBe(false);
    });

    it("credits the follows already on the books", () => {
        // Telling somebody who follows four people to follow five more is a
        // different requirement than the one that sent them here.
        const result = followRequirement({
            alreadyFollowing: 4,
            netChange: 0,
            ...plenty,
        });

        expect(result.stillNeeded).toBe(1);
        expect(result.required).toBe(1);
    });

    it("asks for nothing once the total is met", () => {
        const result = followRequirement({
            alreadyFollowing: 9,
            netChange: 0,
            ...plenty,
        });

        expect(result.stillNeeded).toBe(0);
        expect(result.canFinish).toBe(true);
    });

    it("opens the button as soon as the net change reaches the requirement", () => {
        const result = followRequirement({
            alreadyFollowing: 2,
            netChange: 3,
            ...plenty,
        });

        expect(result.required).toBe(3);
        expect(result.progress).toBe(3);
        expect(result.canFinish).toBe(true);
    });

    describe("a list that cannot supply the requirement", () => {
        it("drops the requirement to what is on screen", () => {
            // Two bots exist for these fields. Waiting for five would be
            // waiting for something nothing on screen can satisfy.
            const result = followRequirement({
                alreadyFollowing: 0,
                followable: 2,
                listIsFinal: true,
                netChange: 2,
            });

            expect(result.required).toBe(2);
            expect(result.canFinish).toBe(true);
        });

        it("lets an empty final list through", () => {
            const result = followRequirement({
                alreadyFollowing: 0,
                followable: 0,
                listIsFinal: true,
                netChange: 0,
            });

            expect(result.required).toBe(0);
            expect(result.canFinish).toBe(true);
        });

        it("holds the full requirement while a page is still in flight", () => {
            // Otherwise the finish button is briefly open over a list that has
            // not arrived — the state a first render is always in.
            const result = followRequirement({
                alreadyFollowing: 0,
                followable: 0,
                listIsFinal: false,
                netChange: 0,
            });

            expect(result.required).toBe(MIN_FOLLOWS);
            expect(result.canFinish).toBe(false);
        });
    });

    it("never reports negative progress", () => {
        // Somebody who arrives and unfollows two bots is at −2. Reported as
        // progress that reads badly; reported as zero it is honest, and
        // `canFinish` still says no.
        const result = followRequirement({
            alreadyFollowing: 7,
            netChange: -2,
            ...plenty,
        });

        expect(result.progress).toBe(0);
        expect(result.stillNeeded).toBe(0);
        expect(result.canFinish).toBe(false);
    });
});

describe("netFollowChange", () => {
    it("counts a follow made in the flow", () => {
        expect(netFollowChange(set("a"), set())).toBe(1);
    });

    it("does not count a bot that arrived already followed", () => {
        // It is part of the profile's `followingCount` already, and counting
        // it again would let a returning user out having followed nobody.
        expect(netFollowChange(set("a"), set("a"))).toBe(0);
    });

    it("goes negative when an earlier follow is undone", () => {
        expect(netFollowChange(set(), set("a", "b"))).toBe(-2);
    });

    it("nets a follow against an unfollow", () => {
        expect(netFollowChange(set("b"), set("a"))).toBe(0);
    });
});
