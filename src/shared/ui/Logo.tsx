import { Image } from "react-native";
import { useColorScheme } from "nativewind";

import logo from "../assets/logo.png";

export interface LogoProps {
    /** Rendered square. 400×400 source, so anything up to that stays sharp. */
    size?: number;
}

/**
 * The mark.
 *
 * It is a white glyph baked onto an opaque black square and greyscale end to
 * end, which is what makes inverting it exact: the glyph goes black, the square
 * goes white, and the square disappears into a light page the same way it
 * disappears into a dark one. Without the invert it reads as a black tile
 * stamped on white rather than as a logo.
 *
 * The web does this with a `light:invert` class. React Native has no such
 * utility, but it has supported the `filter` style since 0.76, so the same
 * effect is reached by branching on the resolved scheme. `colorScheme` is
 * `undefined` before the first resolve, and treating that as dark is right —
 * dark is what the app defaults to.
 */
export function Logo({ size = 48 }: LogoProps) {
    const { colorScheme } = useColorScheme();

    return (
        <Image
            source={logo}
            accessibilityLabel="TDN"
            resizeMode="contain"
            // One object rather than an array: inside a style array TypeScript
            // resolves `filter` against the array's own method and rejects the
            // string form the style actually takes.
            style={{
                width: size,
                height: size,
                ...(colorScheme === "light" ? { filter: "invert(1)" } : {}),
            }}
        />
    );
}
