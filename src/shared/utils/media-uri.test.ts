import { describe, expect, it } from "vitest";

import { getSafeMediaUri, isVideoUri } from "./media-uri";

describe("isVideoUri", () => {
    it.each(["clip.mp4", "clip.webm", "clip.ogg", "clip.mov"])(
        "reads %s as video",
        (name) => {
            expect(isVideoUri(`https://cdn.tdn.dev/${name}`)).toBe(true);
        },
    );

    it("ignores case", () => {
        expect(isVideoUri("https://cdn.tdn.dev/CLIP.MP4")).toBe(true);
    });

    it("looks past a query string", () => {
        // A CDN that signs its URLs appends one, and the extension is no
        // longer the last thing in the string.
        expect(isVideoUri("https://cdn.tdn.dev/clip.mp4?token=abc")).toBe(true);
        expect(isVideoUri("https://cdn.tdn.dev/clip.mp4#t=10")).toBe(true);
    });

    it.each(["shot.png", "shot.jpg", "shot.webp", "shot.gif"])(
        "reads %s as an image",
        (name) => {
            expect(isVideoUri(`https://cdn.tdn.dev/${name}`)).toBe(false);
        },
    );

    it("does not match an extension in the middle of a path", () => {
        expect(isVideoUri("https://cdn.tdn.dev/mp4/shot.png")).toBe(false);
    });
});

describe("getSafeMediaUri", () => {
    it.each([
        "https://cdn.tdn.dev/shot.png",
        "http://cdn.tdn.dev/shot.png",
        "  https://cdn.tdn.dev/shot.png  ",
    ])("passes %s through", (uri) => {
        expect(getSafeMediaUri(uri)).toBe(uri.trim());
    });

    it.each([
        ["a local path", "file:///data/user/0/secrets.txt"],
        ["a data URI", "data:image/png;base64,AAAA"],
        ["a script URL", "javascript:alert(1)"],
        ["a bare path", "/shot.png"],
        ["nothing", ""],
    ])("refuses %s", (_label, uri) => {
        expect(getSafeMediaUri(uri)).toBeNull();
    });

    it("refuses a missing value", () => {
        expect(getSafeMediaUri(null)).toBeNull();
        expect(getSafeMediaUri(undefined)).toBeNull();
    });
});
