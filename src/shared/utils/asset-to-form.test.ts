import { describe, expect, it } from "vitest";

import { assetToFormPart, buildMediaForm } from "./asset-to-form";

describe("assetToFormPart", () => {
    it("keeps what the picker supplied", () => {
        expect(
            assetToFormPart(
                {
                    uri: "file:///data/shot.png",
                    fileName: "shot.png",
                    mimeType: "image/png",
                },
                0,
            ),
        ).toEqual({
            uri: "file:///data/shot.png",
            name: "shot.png",
            type: "image/png",
        });
    });

    it("names a file the picker did not name", () => {
        // Android's photo picker hands back a content URI with no name at all,
        // and a part with no name is rejected by the multipart parser before
        // it ever reaches moderation.
        expect(
            assetToFormPart(
                { uri: "content://media/external/images/1", fileName: null },
                2,
            ).name,
        ).toBe("upload-2");
    });

    it("takes the extension from the URI when there is one", () => {
        const part = assetToFormPart(
            { uri: "file:///data/IMG_0001.JPG", fileName: null },
            0,
        );

        expect(part.name).toBe("upload-0.jpg");
        expect(part.type).toBe("image/jpeg");
    });

    it.each([
        ["file:///a/clip.mp4", "video/mp4"],
        ["file:///a/clip.mov", "video/quicktime"],
        ["file:///a/shot.webp", "image/webp"],
        ["file:///a/shot.heic", "image/heic"],
    ])("derives %s as %s", (uri, type) => {
        expect(assetToFormPart({ uri }, 0).type).toBe(type);
    });

    it("looks past a query string", () => {
        expect(
            assetToFormPart({ uri: "https://cdn.test/shot.png?v=2" }, 0).type,
        ).toBe("image/png");
    });

    it("falls back rather than guessing", () => {
        // Better an honest `application/octet-stream` — which the server will
        // reject clearly — than a made-up `image/png` for something that is
        // not one.
        expect(assetToFormPart({ uri: "content://media/1" }, 0).type).toBe(
            "application/octet-stream",
        );
    });

    it("prefers the picker's own type over the extension", () => {
        expect(
            assetToFormPart(
                { uri: "file:///a/thing.png", mimeType: "image/heic" },
                0,
            ).type,
        ).toBe("image/heic");
    });
});

describe("buildMediaForm", () => {
    it("appends every file under the same field name", () => {
        // `/media` takes up to four parts all called `files`, not `files[0]`.
        const form = buildMediaForm([
            { uri: "file:///a/1.png" },
            { uri: "file:///a/2.png" },
        ]);

        expect(form.getAll("files")).toHaveLength(2);
    });

    it("builds an empty body for an empty selection", () => {
        expect(buildMediaForm([]).getAll("files")).toEqual([]);
    });
});
